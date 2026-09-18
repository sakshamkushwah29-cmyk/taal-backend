const TicketBooking = require("../../models/TicketBooking");
const SaleOrder = require("../../models/SaleOrder");
const catchAsync = require("../../utils/catchAsync");
const { successRes } = require("../../utils/responseFormatter");
const mongoose = require("mongoose");

const getOverallTicketsFromUsers = catchAsync(async (req, res, next) => {
    const { sessionId } = req.query;

    // ✅ Single filter for both tickets count and totalAmount
    const baseFilter = {
        generatedBy: "user",
        ticketStatus: "confirmed",
        paymentStatus: "paid",
        totalAmount: { $gte: 250 }
    };

    if (sessionId) {
        if (mongoose.Types.ObjectId.isValid(sessionId)) {
            baseFilter.eventSession = new mongoose.Types.ObjectId(sessionId);
        } else {
            baseFilter.eventSession = sessionId;
        }
    }

    const result = await TicketBooking.aggregate([
        { $match: baseFilter },
        {
            $project: {
                ticketCount: { $size: { $ifNull: ["$tickets", []] } },
                totalAmount: { $ifNull: ["$totalAmount", 0] }
            }
        },
        {
            $group: {
                _id: null,
                totalTickets: { $sum: "$ticketCount" },
                totalAmount: { $sum: "$totalAmount" }
            }
        }
    ]);

    if (result.length === 0) {
        return successRes(res, 200, true, "No tickets sold yet", {
            totalTickets: 0,
            totalAmount: 0
        });
    }

    const data = result[0];

    return successRes(res, 200, true, "Dashboard data fetched successfully", {
        totalTickets: data.totalTickets,
        totalAmount: data.totalAmount
    });
});

const getOrderInsights = catchAsync(async (req, res, next) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const baseMatch = { isDeleted: { $ne: true } };

    const [result] = await SaleOrder.aggregate([
        { $match: baseMatch },
        {
            $facet: {
                // Total orders + lifetime paid revenue
                totals: [
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            totalRevenue: {
                                $sum: {
                                    $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0]
                                }
                            }
                        }
                    }
                ],
                // Count by order status
                byOrderStatus: [
                    { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
                ],
                // Count by payment status
                byPaymentStatus: [
                    { $group: { _id: "$paymentStatus", count: { $sum: 1 } } }
                ],
                // Today's orders + revenue
                today: [
                    { $match: { createdAt: { $gte: startOfToday } } },
                    {
                        $group: {
                            _id: null,
                            todayOrders: { $sum: 1 },
                            todayRevenue: {
                                $sum: {
                                    $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0]
                                }
                            }
                        }
                    }
                ],
                // Latest 5 orders (compact)
                latestOrders: [
                    { $sort: { createdAt: -1, _id: 1 } },
                    { $limit: 5 },
                    {
                        $project: {
                            _id: 1,
                            total: 1,
                            orderStatus: 1,
                            paymentStatus: 1,
                            createdAt: 1,
                            itemsCount: { $size: { $ifNull: ["$items", []] } },
                            firstItemTitle: { $arrayElemAt: ["$items.titleSnapshot", 0] }
                        }
                    }
                ]
            }
        }
    ]);

    const statusToObj = (arr) =>
        (arr || []).reduce((acc, cur) => {
            if (cur._id) acc[cur._id] = cur.count;
            return acc;
        }, {});

    const totals = result?.totals?.[0] || { totalOrders: 0, totalRevenue: 0 };
    const today = result?.today?.[0] || { todayOrders: 0, todayRevenue: 0 };
    const orderStatusCounts = statusToObj(result?.byOrderStatus);

    const pendingOrders =
        (orderStatusCounts.placed || 0) +
        (orderStatusCounts.packed || 0) +
        (orderStatusCounts.shipped || 0);

    return successRes(res, 200, true, "Order insights fetched successfully", {
        totalOrders: totals.totalOrders || 0,
        totalRevenue: totals.totalRevenue || 0,
        todayOrders: today.todayOrders || 0,
        todayRevenue: today.todayRevenue || 0,
        pendingOrders,
        completedOrders: orderStatusCounts.delivered || 0,
        cancelledOrders: orderStatusCounts.cancelled || 0,
        orderStatusCounts,
        paymentStatusCounts: statusToObj(result?.byPaymentStatus),
        latestOrders: result?.latestOrders || []
    });
});

module.exports = { getOverallTicketsFromUsers, getOrderInsights };
