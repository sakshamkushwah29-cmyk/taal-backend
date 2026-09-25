const Address = require("../../models/Address");
const ProductRent = require("../../models/ProductRent");
const RentBooking = require("../../models/RentBooking");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const { successRes } = require("../../utils/responseFormatter");
const mongoose = require("mongoose");
const { createPaymentForOrder } = require("../commonController/checkoutController");
const QueryBuilder = require("../../services/queryBuilder");
const ENVIRONMENT = require("../../config/env");
const crypto = require("crypto");
const Razorpay = require('razorpay');


const rpInstance = () => new Razorpay({
    key_id: String(ENVIRONMENT.RAZORPAY_KEY_ID || 'rzp_live_RJ78sILs64v88G').trim(),
    key_secret: String(ENVIRONMENT.RAZORPAY_KEY_SECRET || 'lKEjpXVwhpe1FGEHQ2SD15ys').trim()
});

const parseCSV = (val) =>
    typeof val === 'string'
        ? val.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(val) ? val : undefined;

const toBool = (v) => v === '1' || v === 'true' || v === true;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sortStages = (sortKey, mode = 'product') => {
    switch (sortKey) {
        case 'newest': return [{ $sort: { createdAt: -1, _id: 1 } }];
        case 'oldest': return [{ $sort: { createdAt: 1, _id: 1 } }];
        case 'price_asc': return mode === 'product'
            ? [{ $sort: { minPrice: 1, _id: 1 } }]
            : [{ $sort: { effectivePrice: 1, _id: 1 } }];
        case 'price_desc': return mode === 'product'
            ? [{ $sort: { minPrice: -1, _id: 1 } }]
            : [{ $sort: { effectivePrice: -1, _id: 1 } }];
        case 'discount_desc': return mode === 'product'
            ? [{ $sort: { maxDiscountPct: -1, _id: 1 } }]
            : [{ $sort: { discountPct: -1, _id: 1 } }];
        default: return [{ $sort: { createdAt: -1, _id: 1 } }];
    }
};

exports.rentProductList = catchAsync(async (req, res, next) => {
    const {
        page = 1,
        limit = 24,
        sort = 'relevance',
        mode = 'product', // product | variant
        q,
        category,
        tags,
        colors,
        sizes,
        minPrice,
        maxPrice,
        inStock,
        hasDiscount,
        status,
        gender
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
    const skip = (pageNum - 1) * perPage;

    const tagList = parseCSV(tags);
    const colorList = parseCSV(colors);
    const sizeList = parseCSV(sizes);

    // ---- Product filters ----
    const productMatch = {};
    productMatch.isDeleted = false;
    productMatch.status = status || 'active';

    if (category) {
        if (!mongoose.isValidObjectId(category)) {
            return next(new AppError('Invalid category id', 400));
        }
        productMatch.category = new mongoose.Types.ObjectId(category);
    }

    if (tagList?.length) {
        productMatch.tags = { $in: tagList };
    }

    if (gender) {
        const g = String(gender).toLowerCase();
        const allowed = ['men', 'women', 'unisex', 'boys', 'girls'];
        if (!allowed.includes(g)) return next(new AppError('Invalid gender value', 400));
        productMatch.gender = g;
    }

    // ---- Variant filters ----
    const variantMatch = {};
    if (colorList?.length) variantMatch['variants.color'] = { $in: colorList };
    if (sizeList?.length) variantMatch['variants.size'] = { $in: sizeList };
    if (toBool(inStock)) variantMatch['variants.stock'] = { $gt: 0 };
    if (toBool(hasDiscount)) variantMatch['variants.discountPrice'] = { $gt: 0 };

    // ---- Pipeline ----
    const pipeline = [
        { $match: productMatch },
        { $unwind: "$variants" },
        Object.keys(variantMatch).length ? { $match: variantMatch } : null,
    ].filter(Boolean);

    // ---- Search ----
    if (q && q.trim()) {
        const tokens = q.trim().split(/\s+/).slice(0, 6);
        const andClauses = tokens.map(tok => {
            const rx = new RegExp(escapeRegExp(tok), 'i');
            return {
                $or: [
                    { title: rx },
                    { description: rx },
                    { tags: rx },
                    { 'variants.color': rx },
                    { 'variants.size': rx },
                    { 'variants.sku': rx },
                ]
            };
        });
        pipeline.push({ $match: { $and: andClauses } });
    }

    // ---- Effective Price / Discount ----
    pipeline.push({
        $addFields: {
            effectivePrice: {
                $cond: [
                    { $and: [{ $gt: ['$variants.discountPrice', 0] }] },
                    '$variants.discountPrice',
                    '$variants.price'
                ]
            },
            discountPct: {
                $cond: [
                    { $and: [{ $gt: ['$variants.discountPrice', 0] }, { $gt: ['$variants.price', 0] }] },
                    {
                        $multiply: [
                            {
                                $divide: [
                                    { $subtract: ['$variants.price', '$variants.discountPrice'] },
                                    '$variants.price'
                                ]
                            },
                            100
                        ]
                    },
                    0
                ]
            }
        }
    });

    // ---- Price range filter ----
    if (minPrice || maxPrice) {
        const range = {};
        if (minPrice) range.$gte = Number(minPrice);
        if (maxPrice) range.$lte = Number(maxPrice);
        pipeline.push({ $match: { effectivePrice: range } });
    }

    // ---- Variant mode ----
    if (mode === 'variant') {
        pipeline.push(
            {
                $project: {
                    _id: 1,
                    title: 1,
                    slug: 1,
                    category: 1,
                    status: 1,
                    createdAt: 1,
                    variantId: '$variants._id',
                    color: '$variants.color',
                    size: '$variants.size',
                    sku: '$variants.sku',
                    stock: '$variants.stock',
                    images: '$variants.images',
                    price: '$variants.price',
                    discountPrice: '$variants.discountPrice',
                    effectivePrice: 1,
                    discountPct: 1
                }
            },
            ...sortStages(sort, 'variant'),
            {
                $facet: {
                    items: [{ $skip: skip }, { $limit: perPage }],
                    total: [{ $count: 'count' }]
                }
            }
        );

        const [{ items, total }] = await ProductRent.aggregate(pipeline);
        const totalItems = total?.[0]?.count || 0;
        return successRes(res, 200, true, 'Rent variants fetched', {
            page: pageNum,
            limit: perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
            mode: 'variant',
            items
        });
    }

    // ---- Product regroup ----
    pipeline.push(
        {
            $group: {
                _id: '$_id',
                title: { $first: '$title' },
                slug: { $first: '$slug' },
                description: { $first: '$description' },
                category: { $first: '$category' },
                tags: { $first: '$tags' },
                status: { $first: '$status' },
                createdAt: { $first: '$createdAt' },
                minPrice: { $min: '$effectivePrice' },
                maxPrice: { $max: '$effectivePrice' },
                maxDiscountPct: { $max: '$discountPct' },
                totalStock: { $sum: '$variants.stock' },
                variantCount: { $sum: 1 },
                thumbnail: {
                    $first: {
                        $cond: [
                            { $gt: [{ $size: { $ifNull: ['$variants.images', []] } }, 0] },
                            { $arrayElemAt: ['$variants.images', 0] },
                            null
                        ]
                    }
                }
            }
        },
        ...sortStages(sort, 'product'),
        {
            $facet: {
                items: [{ $skip: skip }, { $limit: perPage }],
                total: [{ $count: 'count' }]
            }
        }
    );

    const [{ items, total }] = await ProductRent.aggregate(pipeline);
    const totalItems = total?.[0]?.count || 0;
    return successRes(res, 200, true, 'Rent products fetched', {
        page: pageNum,
        limit: perPage,
        totalItems,
        totalPages: Math.ceil(totalItems / perPage),
        mode: 'product',
        items
    });
});

exports.getRentProductById = catchAsync(async (req, res, next) => {
    const { productId, variantId } = req.query;

    if (!productId) return next(new AppError('productId query parameter is required', 400));
    if (!mongoose.isValidObjectId(productId)) return next(new AppError('Invalid productId', 400));

    // fetch product (with category minimal)
    const product = await ProductRent.findById(productId)
        .populate('category', 'name slug')
        .lean();

    if (!product) return next(new AppError('Product not found', 404));

    // helpers
    const calcEffectivePrice = v => {
        const p = Number(v.price || 0);
        const dp = Number(v.discountPrice || 0);
        return dp && dp > 0 ? dp : p;
    };
    const calcDiscountPct = v => {
        const p = Number(v.price || 0);
        const dp = Number(v.discountPrice || 0);
        if (p > 0 && dp > 0) return ((p - dp) / p) * 100;
        return 0;
    };

    // ensure variants array
    const rawVariants = Array.isArray(product.variants) ? product.variants : [];

    // compute runtime fields per variant
    const variants = rawVariants.map(v => {
        const effectivePrice = calcEffectivePrice(v);
        const discountPct = calcDiscountPct(v);
        const stock = Number(v.stock || 0);
        const inStock = stock > 0;
        return {
            variantId: v._id ? String(v._id) : null,
            color: v.color || null,
            size: v.size || null,
            sku: v.sku || null,
            price: Number(v.price || 0),
            discountPrice: Number(v.discountPrice || 0),
            effectivePrice,
            discountPct: Number(discountPct.toFixed(2)),
            stock,
            inStock,
            images: Array.isArray(v.images) ? v.images : [],
            raw: v // optional: raw fields if you need more later
        };
    });

    // pricing & stock summary
    const effectivePrices = variants.map(v => v.effectivePrice).filter(p => typeof p === 'number');
    const minPrice = effectivePrices.length ? Math.min(...effectivePrices) : 0;
    const maxPrice = effectivePrices.length ? Math.max(...effectivePrices) : 0;
    const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

    // build variant options & matrix: colors, sizes, colorSummary
    const colorsSet = new Set();
    const sizesSet = new Set();
    const matrix = {}; // matrix[color][size] => variant info
    const colorSummary = {}; // color -> { totalStock, minPrice, thumbnail }

    for (const v of variants) {
        const c = (v.color || 'other').toString();
        const s = (v.size || 'free').toString();
        colorsSet.add(c);
        sizesSet.add(s);

        matrix[c] = matrix[c] || {};
        matrix[c][s] = {
            variantId: v.variantId,
            sku: v.sku,
            price: v.price,
            discountPrice: v.discountPrice,
            effectivePrice: v.effectivePrice,
            discountPct: v.discountPct,
            stock: v.stock,
            inStock: v.inStock,
            images: v.images
        };

        if (!colorSummary[c]) {
            colorSummary[c] = { totalStock: 0, minPrice: v.effectivePrice, thumbnail: v.images && v.images[0] ? v.images[0] : null };
        }
        colorSummary[c].totalStock += v.stock || 0;
        if (v.effectivePrice < (colorSummary[c].minPrice || Infinity)) {
            colorSummary[c].minPrice = v.effectivePrice;
            if (v.images && v.images[0]) colorSummary[c].thumbnail = v.images[0];
        }
    }

    const availableColors = Array.from(colorsSet);
    const availableSizes = Array.from(sizesSet);

    // Determine selected/default variant
    let selectedVariant = null;
    let selectedVariantId = null;

    if (variantId) {
        if (!mongoose.isValidObjectId(variantId)) return next(new AppError('Invalid variantId', 400));
        selectedVariant = variants.find(v => v.variantId === String(variantId));
        if (!selectedVariant) return next(new AppError('Variant not found for this product', 404));
        selectedVariantId = selectedVariant.variantId;
    } else {
        // default selection logic:
        // 1) prefer in-stock variants (lowest effectivePrice among in-stock)
        // 2) if none in stock, choose absolute lowest effectivePrice
        const inStockVariants = variants.filter(v => v.inStock);
        if (inStockVariants.length) {
            inStockVariants.sort((a, b) => a.effectivePrice - b.effectivePrice);
            selectedVariant = inStockVariants[0];
        } else if (variants.length) {
            variants.sort((a, b) => a.effectivePrice - b.effectivePrice);
            selectedVariant = variants[0];
        }
        selectedVariantId = selectedVariant ? selectedVariant.variantId : null;
    }

    // Build response; keep heavy fields (raw) optional — here we include variants (computed) for UI
    const response = {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        category: product.category || null,
        tags: product.tags || [],
        gender: product.gender || null,
        status: product.status || null,
        createdAt: product.createdAt,

        pricing: {
            minPrice,
            maxPrice,
            totalStock
        },

        variantsCount: variants.length,
        availableColors,
        availableSizes,
        colorSummary,   // per-color quick info (thumbnail, minPrice, totalStock)
        matrix,         // matrix[color][size] => variant info (for UI selection)
        variants,       // full list of computed variants (good for listing/selecting)
        defaultVariantId: selectedVariantId, // UI can use this as the default selected
        selectedVariantId,
        selectedVariant: selectedVariant || null,
        rentPricePerDay: product.rentPricePerDay || selectedVariant?.effectivePrice || minPrice || 50,
        deposit: product.deposit !== undefined && product.deposit !== null ? product.deposit : 450,
        currency: product.currency || "INR",
    };

    return successRes(res, 200, true, "Product found", response);
});

/**============== Rent Booking ============== */

// controllers/rent.controller.js

function calculateRentAmount({ product, variant, qty, startDate, endDate }) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // base rent per day
    const pricePerDay = Number(product.rentPricePerDay) || Number(variant?.effectivePrice) || Number(variant?.discountPrice) || Number(variant?.price) || 50;
    const rent = pricePerDay * qty * days;

    // deposit (refundable upon safe return)
    const depositPerUnit = (product.deposit !== undefined && product.deposit !== null && product.deposit >= 0)
        ? Number(product.deposit)
        : 450;
    const deposit = depositPerUnit * qty;

    return {
        total: rent + deposit,
        currency: product.currency || "INR",
        rent,
        deposit,
        pricePerDay,
        days
    };
}

exports.rentNow = catchAsync(async (req, res, next) => {
    const userId = req.user?._id;
    const { productId, variantId, qty = 1, startDate, endDate, addressId, paymentMethod, gateway = 'razorpay' } = req.body;

    // Validate required fields and constraints
    if (!userId) return next(new AppError('Unauthorized', 401));
    if (!mongoose.Types.ObjectId.isValid(productId)) return next(new AppError('Invalid productId', 400));
    if (!mongoose.Types.ObjectId.isValid(variantId)) return next(new AppError('Invalid variantId', 400));
    if (!mongoose.Types.ObjectId.isValid(addressId)) return next(new AppError('Invalid addressId', 400));
    if (!['cod', 'online'].includes(String(paymentMethod))) return next(new AppError('Invalid paymentMethod', 400));
    if (!startDate || !endDate || new Date(startDate) >= new Date(endDate)) {
        return next(new AppError('Invalid start or end date', 400));
    }
    const quantity = Math.max(1, Number(qty));
    if (!Number.isInteger(quantity) || quantity < 1) {
        return next(new AppError('Quantity must be a positive integer', 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Load product and variant inside transaction
        const product = await ProductRent.findById(productId).session(session);
        if (!product) throw new AppError('Product not found', 404);

        const variant = product.variants.id(variantId);
        if (!variant) throw new AppError('Variant not found', 404);

        if (variant.stock < quantity) throw new AppError('Insufficient stock', 400);

        // Atomic stock decrement for variant stock
        const stockDecrementResult = await ProductRent.updateOne(
            { _id: productId, "variants._id": variantId, "variants.stock": { $gte: quantity } },
            { $inc: { "variants.$.stock": -quantity } }
        ).session(session);
        if (stockDecrementResult.modifiedCount === 0) {
            throw new AppError('Insufficient stock or stock changed, please try again', 409);
        }

        // Recalculate totalStock from all variants (optional, for consistency)
        product.totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
        await product.save({ session });

        // Fetch and validate address for snapshot
        const address = await Address.findOne({ _id: addressId, isDeleted: false }).session(session);
        if (!address) throw new AppError('Address not found', 404);

        // Calculate rent amounts
        const amountInfo = calculateRentAmount({ product, variant, qty: quantity, startDate, endDate });

        // Create booking document inside transaction
        const [booking] = await RentBooking.create([{
            user: userId,
            items: [{
                product: product._id,
                variantId: variant._id,
                size: variant.size,
                qty: quantity,
                pricePerDaySnapshot: product.rentPricePerDay,
                productSnapshot: {
                    _id: product._id,
                    title: product.title,
                    sku: product.sku,
                    deposit: product.deposit,
                    rentPricePerDay: product.rentPricePerDay,
                    currency: product.currency,
                    variantSnapshot: {
                        _id: variant._id,
                        color: variant.color,
                        size: variant.size,
                        sku: variant.sku
                    },
                    images: product.images || []
                }
            }],
            startDate,
            endDate,
            days: amountInfo.days,
            rentAmount: amountInfo.rent,
            depositAmount: amountInfo.deposit,
            total: amountInfo.total,
            currency: amountInfo.currency || product.currency,
            paymentMethod,
            paymentStatus: 'pending',
            pickupAddress: address._id,
            pickupAddressSnapshot: {
                fullName: address.fullName,
                phone: address.phone,
                labeL: address.label, // typo kept to match schema
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                country: address.country
            },
            orderStatus: 'pending'
        }], { session });

        // Commit all changes atomically
        await session.commitTransaction();
        session.endSession();

        // Create payment intent if online payment method used
        let payment = null;
        if (paymentMethod === 'online') {
            payment = await createPaymentForOrder({
                order: booking,
                user: req.user,
                gateway
            });
        }

        return successRes(res, 201, true, 'Booking Created', {
            status: booking.orderStatus,
            booking,
            payment
        });
    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        return next(new AppError(err.message || 'Server error', err.statusCode || 500));
    }
});

exports.verifyRentPayment = catchAsync(async (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // 1) basic validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return next(new AppError('razorpay_order_id, razorpay_payment_id and razorpay_signature are required', 400));
    }
    const secret = String(ENVIRONMENT.RAZORPAY_KEY_SECRET || 'lKEjpXVwhpe1FGEHQ2SD15ys').trim();

    // 2) verify signature (HMAC SHA256 of order_id|payment_id)
    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generatedSignature !== String(razorpay_signature)) {
        return next(new AppError('Invalid signature - verification failed', 400));
    }

    // 3) find local order (try provided orderId first, then paymentIntentId mapping)
    let order = null;
    if (orderId && mongoose.isValidObjectId(orderId)) {
        order = await RentBooking.findById(orderId);
    }
    if (!order) {
        order = await RentBooking.findOne({ paymentIntentId: razorpay_order_id, _id: orderId });
    }

    if (!order) {
        // Not found locally — still possible (race / missing mapping). Return helpful message.
        return next(new AppError('Order not found for the provided payment/order id', 404));
    }

    // 4) idempotency: if already paid, return success
    if (order.paymentStatus === 'paid') {
        return successRes(res, 200, 'Payment already verified for this order', order);
    }

    // 5) optional sanity checks by fetching payment entity from Razorpay
    const rp = rpInstance();
    let paymentEntity = null;
    try {
        paymentEntity = await rp.payments.fetch(razorpay_payment_id);
    } catch (err) {
        // If fetch fails, we can still accept signature verification as valid, but it's safer to fail here.
        // Return a 502 so client can retry or use webhook as fallback.
        return next(new AppError('Unable to fetch payment details from Razorpay: ' + (err.message || err), 502));
    }

    // Ensure payment belongs to order
    if (String(paymentEntity.order_id) !== String(razorpay_order_id)) {
        return next(new AppError('Payment does not belong to the provided order (order id mismatch)', 400));
    }

    // Check payment status: prefer 'captured' (payment completed)
    // Some integrations may show 'authorized' depending on capture mode; treat 'captured' as success.
    const successStatuses = ['captured', 'authorized'];
    if (!successStatuses.includes(paymentEntity.status)) {
        return next(new AppError(`Payment status is '${paymentEntity.status}' — not a successful payment`, 400));
    }

    // 6) optional amount check (razorpay amounts in paise)
    const paidAmountPaise = Number(paymentEntity.amount || 0);
    const expectedPaise = Math.round(Number(order.total || 0) * 100); // order.total assumed in rupees

    let amountMismatch = false;
    if (paidAmountPaise !== expectedPaise) {
        amountMismatch = true;
        // don't automatically fail — record mismatch for manual reconciliation
        order.notes = (order.notes ? order.notes + ' | ' : '') +
            `PAYMENT_AMOUNT_MISMATCH(razorpay=${paidAmountPaise},expected=${expectedPaise})`;
    }

    // 7) update order idempotently
    order.paymentStatus = 'paid';
    order.paymentGateway = 'razorpay';
    order.paymentIntentId = razorpay_order_id;
    order.paymentResponse = {
        verifiedAt: new Date(),
        razorpay_payment_id,
        razorpay_order_id,
        raw: paymentEntity,
        amountMismatch
    };
    order.orderStatus = 'booked'; // keep or set placed
    await order.save();
    return successRes(res, 200, true, 'Payment verified and order updated', {
        order,
        note: amountMismatch ? 'Amount mismatch detected — flagged in order.notes' : undefined,
    })

});








