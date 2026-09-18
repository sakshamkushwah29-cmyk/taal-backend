const mongoose = require("mongoose");
const { toInt, isValidId } = require("../../helper/productHelper");
const SaleOrder = require("../../models/SaleOrder");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const { successRes } = require("../../utils/responseFormatter");

/**
 * (Optional) ADMIN list — if needed later
 * GET /api/v1/admin/orders
 * Supports user/email search, statuses, date range, pagination, etc.
 */
exports.adminListOrders = catchAsync(async (req, res, next) => {
    // only if req.user.role === 'admin' (guard outside)
    const {
        page = 1,
        limit = 30,
        sort = 'newest',
        q, // orderId/email/sku
        orderStatus,
        paymentStatus,
        from,
        to
    } = req.query;

    const pageNum = toInt(page, 1);
    const perPage = Math.min(toInt(limit, 20), 200);
    const skip = (pageNum - 1) * perPage;

    const match = { isDeleted: { $ne: true } };
    if (orderStatus) match.orderStatus = orderStatus;
    if (paymentStatus) match.paymentStatus = paymentStatus;
    if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = new Date(from + 'T00:00:00.000Z');
        if (to) match.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const pipeline = [
        { $match: match },
        ...(q && q.trim()
            ? [{
                $match: {
                    $or: [
                        { _id: isValidId(q) ? new mongoose.Types.ObjectId(q) : null },
                        { notes: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                        { 'items.skuSnapshot': new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                        { 'items.titleSnapshot': new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
                    ]
                }
            }]
            : []),
        // populate user
        {
            $lookup: {
                from: 'users',
                let: { uid: "$user" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
                    { $project: { _id: 1, name: 1, email: 1, phone: 1 } }
                ],
                as: "user"
            }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

        // populate address
        {
            $lookup: {
                from: 'addresses',
                let: { aid: "$address" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$_id", "$$aid"] } } },
                    {
                        $project: {
                            _id: 1,
                            label: 1,
                            line1: 1,
                            line2: 1,
                            city: 1,
                            state: 1,
                            pincode: 1,
                            country: 1,
                            lat: 1,
                            lng: 1,
                            isDefault: 1
                        }
                    }
                ],
                as: "address"
            }
        },
        { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                _id: 1,
                user: 1,
                address: 1,
                createdAt: 1,
                orderStatus: 1,
                paymentStatus: 1,
                paymentGateway: 1,
                total: 1,
                currency: 1,
                itemsCount: { $size: { $ifNull: ['$items', []] } }
            }
        },
        ...(() => {
            switch (sort) {
                case 'oldest': return [{ $sort: { createdAt: 1, _id: 1 } }];
                case 'total_asc': return [{ $sort: { total: 1, _id: 1 } }];
                case 'total_desc': return [{ $sort: { total: -1, _id: 1 } }];
                default: return [{ $sort: { createdAt: -1, _id: 1 } }];
            }
        })(),
        {
            $facet: {
                items: [{ $skip: skip }, { $limit: perPage }],
                total: [{ $count: 'count' }]
            }
        }
    ];
    const [{ items, total }] = await SaleOrder.aggregate(pipeline);
    const totalItems = total?.[0]?.count || 0;
    return successRes(res, 200, true, 'Order list fetched', {
        page: pageNum,
        limit: perPage,
        totalItems,
        totalPages: Math.ceil(totalItems / perPage),
        items
    });
});

// Map orderStatus → timestamp field
const STATUS_TO_TIMESTAMP = {
    placed: 'placedAt',
    packed: 'packedAt',
    shipped: 'shippedAt',
    delivered: 'deliveredAt',
    cancelled: 'cancelledAt',
    returned: 'returnedAt',
};

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
    const { orderStatus, notes, courier, awb, trackingUrl, orderId } = req.body;

    if (!orderStatus) {
        return res.status(400).json({ message: 'orderStatus is required' });
    }

    if (!Object.keys(STATUS_TO_TIMESTAMP).includes(orderStatus)) {
        return next(new AppError('Invalid orderStatus', 400));
    }

    let order = await SaleOrder.findById(orderId);
    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    // Update order status (allowed even if unchanged, so shipment/notes can be edited)
    order.orderStatus = orderStatus;

    // Update timestamp only if null
    const tsField = STATUS_TO_TIMESTAMP[orderStatus];
    if (tsField && !order[tsField]) {
        order[tsField] = new Date();
    }

    // Optional updates
    if (notes) order.notes = notes;
    if (courier || awb || trackingUrl) {
        order.shipment = {
            ...order.shipment,
            courier: courier || order.shipment?.courier,
            awb: awb || order.shipment?.awb,
            trackingUrl: trackingUrl || order.shipment?.trackingUrl,
            status: orderStatus, // keep shipment in sync
        };
    }

    // If cancelled → mark who cancelled (always admin here)
    if (orderStatus === 'cancelled') {
        order.cancelledBy = 'admin';
        if (!order.cancelledAt) order.cancelledAt = new Date();
    }

    await order.save();

    return successRes(res, 200, true, 'Order status updated successfully', order);
});

/**
 * GET /api/v1/superadmin/order-details?orderId=
 * Full order detail for admin: customer, address, items (with current images), timeline.
 */
exports.adminGetOrderById = catchAsync(async (req, res, next) => {
    const { orderId } = req.query;
    if (!isValidId(orderId)) return next(new AppError('Invalid orderId', 400));

    const pipeline = [
        {
            $match: {
                _id: new mongoose.Types.ObjectId(orderId),
                isDeleted: { $ne: true }
            }
        },
        { $limit: 1 },

        // customer
        {
            $lookup: {
                from: 'users',
                let: { uid: '$user' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
                    { $project: { _id: 1, name: 1, email: 1, phone: 1 } }
                ],
                as: 'customer'
            }
        },
        { $addFields: { customer: { $arrayElemAt: ['$customer', 0] } } },

        // address
        {
            $lookup: {
                from: 'addresses',
                localField: 'address',
                foreignField: '_id',
                as: 'addressData'
            }
        },
        { $addFields: { address: { $arrayElemAt: ['$addressData', 0] } } },
        { $project: { addressData: 0 } },

        // per-item product/variant image lookup
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'productsales',
                let: { pid: '$items.product', vid: '$items.variantId' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
                    {
                        $project: {
                            slug: 1,
                            title: 1,
                            variant: {
                                $first: {
                                    $filter: {
                                        input: '$variants',
                                        as: 'v',
                                        cond: { $eq: ['$$v._id', '$$vid'] }
                                    }
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            slug: 1,
                            title: 1,
                            image: {
                                $cond: [
                                    { $gt: [{ $size: { $ifNull: ['$variant.images', []] } }, 0] },
                                    { $arrayElemAt: ['$variant.images', 0] },
                                    null
                                ]
                            }
                        }
                    }
                ],
                as: 'prod'
            }
        },
        {
            $addFields: {
                'items.image': { $arrayElemAt: ['$prod.image', 0] },
                'items.slug': { $arrayElemAt: ['$prod.slug', 0] }
            }
        },
        { $project: { prod: 0 } },

        // regroup items
        {
            $group: {
                _id: '$_id',
                doc: { $first: '$$ROOT' },
                items: { $push: '$items' }
            }
        },
        {
            $replaceRoot: {
                newRoot: {
                    _id: '$_id',
                    customer: '$doc.customer',
                    address: '$doc.address',
                    paymentMethod: '$doc.paymentMethod',
                    paymentStatus: '$doc.paymentStatus',
                    paymentGateway: '$doc.paymentGateway',
                    orderStatus: '$doc.orderStatus',
                    notes: '$doc.notes',
                    shipment: '$doc.shipment',
                    subtotal: '$doc.subtotal',
                    shippingCharges: '$doc.shippingCharges',
                    total: '$doc.total',
                    currency: '$doc.currency',
                    createdAt: '$doc.createdAt',
                    updatedAt: '$doc.updatedAt',
                    placedAt: '$doc.placedAt',
                    packedAt: '$doc.packedAt',
                    shippedAt: '$doc.shippedAt',
                    deliveredAt: '$doc.deliveredAt',
                    returnedAt: '$doc.returnedAt',
                    cancelledAt: '$doc.cancelledAt',
                    items: '$items'
                }
            }
        },

        // timeline
        {
            $addFields: {
                timeline: [
                    { label: 'Placed', at: '$createdAt', done: true },
                    {
                        label: 'Packed',
                        at: '$packedAt',
                        done: { $cond: [{ $ifNull: ['$packedAt', false] }, true, false] }
                    },
                    {
                        label: 'Shipped',
                        at: '$shippedAt',
                        done: { $cond: [{ $ifNull: ['$shippedAt', false] }, true, false] }
                    },
                    {
                        label: 'Delivered',
                        at: '$deliveredAt',
                        done: { $cond: [{ $ifNull: ['$deliveredAt', false] }, true, false] }
                    }
                ]
            }
        }
    ];

    const data = await SaleOrder.aggregate(pipeline);
    if (!data || !data[0]) return next(new AppError('Order not found', 404));

    return successRes(res, 200, true, 'Order fetched', data[0]);
});

