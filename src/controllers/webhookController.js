// src/controllers/webhookController.js

const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");
const TicketBooking = require("../models/TicketBooking");
const EventSession = require("../models/EventSession");
const crypto = require("crypto");

// const ticketBookingWebHook = catchAsync(async (req, res, next) => {
//     const signature = req.headers["x-razorpay-signature"];
//     const body = req.body;

//     const expectedSignature = crypto
//         .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//         .update(body)
//         .digest("hex");

//     if (signature !== expectedSignature) return res.status(400).send("Invalid signature");

//     const payload = JSON.parse(body.toString());
//     if (payload.event === "payment.captured") {
//         const payment = payload.payload.payment.entity;

//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const booking = await TicketBooking.findOne({ razorpayOrderId: payment.order_id }).session(session);
//             if (!booking) throw new Error("Booking not found");

//             if (booking.paymentStatus === "paid") {
//                 console.log("Already processed");
//                 await session.commitTransaction();
//                 session.endSession();
//                 return res.status(200).send("Already processed");
//             }

//             const eventSession = await EventSession.findById(booking.eventSession).session(session);
//             eventSession.remainingCapacity = Math.max(0, eventSession.remainingCapacity - booking.quantity);
//             await eventSession.save({ session });

//             booking.paymentStatus = "paid";
//             booking.ticketStatus = "pending";
//             booking.razorpayPaymentId = payment.id;
//             booking.paymentProcessedUsing = "webhook"; // << Added
//             await booking.save({ session });

//             await session.commitTransaction();
//             session.endSession();
//             res.status(200).send("Payment processed");
//         } catch (err) {
//             await session.abortTransaction();
//             session.endSession();
//             console.error("Webhook error:", err);
//             res.status(500).send(err.message);
//         }
//     } else {
//         res.status(200).send("Event ignored");
//     }
// });


const ticketBookingWebHook = catchAsync(async (req, res, next) => {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    if (signature !== expectedSignature) return res.status(400).send("Invalid signature");

    const payload = JSON.parse(body.toString());
    const event = payload.event;

    const payment = payload.payload?.payment?.entity;
    if (!payment) return res.status(200).send("Event ignored");

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const booking = await TicketBooking.findOne({ razorpayOrderId: payment.order_id }).session(session);
            if (!booking) throw new Error("Booking not found");

            // ✅ Idempotent check
            if (booking.paymentStatus === "paid") return;

            const sessionData = await EventSession.findById(booking.eventSession).session(session);
            if (!sessionData) throw new Error("Event session not found");

            if (event === "payment.captured") {
                // ✅ Deduct capacity on success
                sessionData.remainingCapacity = Math.max(0, sessionData.remainingCapacity - booking.quantity);

                booking.paymentStatus = "paid";
                booking.ticketStatus = "pending";
                booking.razorpayPaymentId = payment.id;
                booking.paymentProcessedUsing = "webhook";

            } else if (event === "payment.failed") {
                // ✅ Release capacity on failed payment
                sessionData.remainingCapacity = Math.min(
                    sessionData.totalCapacity,
                    sessionData.remainingCapacity + booking.quantity
                );

                booking.paymentStatus = "failed";
                booking.ticketStatus = "cancelled";
                booking.paymentProcessedUsing = "webhook";
            } else {
                return; // ignore other events
            }

            await sessionData.save({ session });
            await booking.save({ session });

        }, {
            readConcern: { level: "local" },
            writeConcern: { w: "majority" },
            readPreference: "primary"
        });

        session.endSession();
        res.status(200).send("Webhook processed");

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Webhook error:", err);
        res.status(500).send(err.message);
    }
});


module.exports = {
    ticketBookingWebHook
};