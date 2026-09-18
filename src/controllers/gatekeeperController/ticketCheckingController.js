const GatekeeperScan = require("../../models/GatekeeperScan");
const TicketBooking = require("../../models/TicketBooking");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const { successRes } = require("../../utils/responseFormatter");
const mongoose = require("mongoose");
const moment = require("moment-timezone");

// exports.validateTicket = catchAsync(async (req, res, next) => {
//     const ticketId = req?.body?.ticketId;
//     const gatekeeperId = req.user?._id;

//     if (!ticketId) return next(new AppError("Ticket ID is required", 400));

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const booking = await TicketBooking.findOne({ "tickets.ticketId": ticketId })
//             .populate("event")
//             .populate("eventSession")
//             .session(session);

//         let result = "valid";
//         let responseMsg = "Ticket validated successfully";
//         let extraData = {};

//         if (!booking) {
//             result = "not_found";
//             responseMsg = "Invalid Ticket - not found";
//             await GatekeeperScan.create([{ gatekeeper: gatekeeperId, ticketId, eventSession: null, event: null, result, notes: responseMsg }], { session });
//             await session.commitTransaction();
//             session.endSession();
//             return successRes(res, 404, false, responseMsg, extraData);
//         }

//         const ticket = booking.tickets.find(t => t.ticketId === ticketId);
//         if (!ticket) {
//             result = "not_found";
//             responseMsg = "Invalid Ticket - not found";
//             await GatekeeperScan.create([{ gatekeeper: gatekeeperId, ticketId, ticketRef: null, eventSession: booking.eventSession, event: booking.event, result, notes: responseMsg }], { session });
//             await session.commitTransaction();
//             session.endSession();
//             return successRes(res, 404, false, responseMsg, extraData);
//         }

//         const now = moment().tz("Asia/Kolkata");
//         ticket.scanHistory = ticket.scanHistory || [];

//         // Event start and end dates in Asia/Kolkata
//         const eventStart = moment.utc(booking.event.startDate).tz("Asia/Kolkata").startOf("day");
//         const eventEnd = moment.utc(booking.event.endDate)
//             .tz("Asia/Kolkata")
//             .subtract(1, "day")   // ✅ subtract 1 day
//             .endOf("day");
//         console.log(eventStart, eventEnd, " event dates");
//         // ---------- Event date validation ----------
//         if (ticket.isVipTicket || ticket.validForAllDays) {
//             // VIP / All-days → check if today is within event dates
//             if (now.isBefore(eventStart, "day") || now.isAfter(eventEnd, "day")) {
//                 result = "invalid";
//                 responseMsg = "Ticket cannot be scanned outside event dates";
//             }
//         } else {
//             // Normal ticket → check against session date
//             const sessionDate = moment.tz(booking.eventSession.date, "Asia/Kolkata").startOf("day");
//             if (!now.isSame(sessionDate, "day")) {
//                 result = "invalid";
//                 responseMsg = "Ticket not valid for today";
//             }
//         }

//         // Session status check for normal tickets
//         if (!ticket.validForAllDays && !ticket.isVipTicket && result === "valid") {
//             if (booking.eventSession?.status === "cancelled") {
//                 result = "invalid";
//                 responseMsg = "This event session has been cancelled";
//             } else if (booking.eventSession?.status === "completed") {
//                 result = "invalid";
//                 responseMsg = "This event session has already been completed";
//             }
//         }

//         // Ticket active/payment check
//         if (ticket.status !== "generated") {
//             result = "invalid";
//             responseMsg = "Ticket not active";
//         } else if (booking.paymentStatus !== "paid") {
//             result = "invalid";
//             responseMsg = "Payment not verified";
//         }

//         // ---------- Scan processing ----------
//         if (result === "valid") {
//             const scanDate = (ticket.isVipTicket || ticket.validForAllDays)
//                 ? now.clone().startOf("day")
//                 : moment.tz(booking.eventSession.date, "Asia/Kolkata");

//             const scanWindowStart = scanDate.clone().hour(16).minute(0).second(0);
//             const scanWindowEnd = scanDate.clone().hour(23).minute(50).second(0);

//             if (!now.isBetween(scanWindowStart, scanWindowEnd, undefined, '[]')) {
//                 result = "invalid";
//                 responseMsg = `Ticket can only be scanned between 18:00 and 23:50`;
//             } else {
//                 // Check already scanned
//                 const alreadyScannedToday = ticket.scanHistory.some(scan =>
//                     moment(scan.scannedAt).tz("Asia/Kolkata").isSame(scanDate, "day")
//                 );

//                 if (alreadyScannedToday) {
//                     result = "already_scanned";
//                     responseMsg = "Ticket already used for today";
//                     const lastScan = ticket.scanHistory[ticket.scanHistory.length - 1];
//                     extraData = { scannedAt: lastScan?.scannedAt, attendeeName: ticket.attendeeName, eventName: booking.event.title };
//                 } else {
//                     ticket.scanHistory.push({ scannedAt: now, session: booking.eventSession._id });
//                     if (!ticket.isVipTicket && !ticket.validForAllDays) {
//                         ticket.scanned = true;
//                         ticket.scannedAt = now;
//                     }

//                     await booking.save({ session });

//                     extraData = {
//                         ticketId: ticket.ticketId,
//                         attendeeName: ticket?.attendeeName,
//                         eventName: booking?.event.title,
//                         validForAllDays: ticket?.validForAllDays,
//                         isVipTicket: ticket?.isVipTicket,
//                         generatedBy: booking?.generatedBy || null,
//                         eventDateTime: `${booking.eventSession.date} | ${booking.eventSession.startTime}-${booking.eventSession.endTime}`,
//                         scannedAt: now,
//                     };
//                 }
//             }
//         }

//         // Save scan log
//         await GatekeeperScan.create([{ gatekeeper: gatekeeperId, ticketId, eventSession: booking.eventSession, ticketRef: ticket._id, event: booking.event, result, notes: responseMsg }], { session });

//         await session.commitTransaction();
//         session.endSession();

//         return successRes(res, result === "valid" ? 200 : 400, result === "valid", responseMsg, extraData);

//     } catch (err) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new AppError(err.message, 500));
//     }
// });

exports.validateTicket = catchAsync(async (req, res, next) => {
    const ticketId = req?.body?.ticketId;
    const gatekeeperId = req.user?._id;

    if (!ticketId) return next(new AppError("Ticket ID is required", 400));

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const booking = await TicketBooking.findOne({ "tickets.ticketId": ticketId })
            .populate("event")
            .populate("eventSession")
            .session(session);

        let result = "valid";
        let responseMsg = "Ticket validated successfully";
        let extraData = {};

        // ------------------ Booking not found ------------------
        if (!booking) {
            result = "not_found";
            responseMsg = "Invalid Ticket - not found";
            await GatekeeperScan.create(
                [{
                    gatekeeper: gatekeeperId,
                    ticketId,
                    eventSession: null,
                    event: null,
                    result,
                    notes: responseMsg
                }],
                { session }
            );
            await session.commitTransaction();
            session.endSession();
            return successRes(res, 404, false, responseMsg, extraData);
        }

        const ticket = booking.tickets.find(t => t.ticketId === ticketId);
        if (!ticket) {
            result = "not_found";
            responseMsg = "Invalid Ticket - not found";
            await GatekeeperScan.create(
                [{
                    gatekeeper: gatekeeperId,
                    ticketId,
                    ticketRef: null,
                    eventSession: booking.eventSession,
                    event: booking.event,
                    result,
                    notes: responseMsg
                }],
                { session }
            );
            await session.commitTransaction();
            session.endSession();
            return successRes(res, 404, false, responseMsg, {});
        }

        const now = moment().tz("Asia/Kolkata");
        ticket.scanHistory = ticket.scanHistory || [];

        // ✅ Common extraData for all cases where ticket exists
        const baseExtraData = {
            ticketId: ticket.ticketId,
            attendeeName: ticket?.attendeeName,
            eventName: booking?.event.title,
            validForAllDays: ticket?.validForAllDays,
            isVipTicket: ticket?.isVipTicket,
            generatedBy: booking?.generatedBy || null,
            eventDateTime: `${booking.eventSession.date} | ${booking.eventSession.startTime}-${booking.eventSession.endTime}`
        };

        // ---------- Event date validation ----------
        const eventStart = moment.utc(booking.event.startDate).tz("Asia/Kolkata").startOf("day");
        const eventEnd = moment.utc(booking.event.endDate)
            .tz("Asia/Kolkata")
            // .subtract(1, "day")
            .endOf("day");
        console.log(eventStart, eventEnd, " event dates");

        if (ticket.isVipTicket || ticket.validForAllDays) {
            if (now.isBefore(eventStart, "day") || now.isAfter(eventEnd, "day")) {
                result = "invalid";
                responseMsg = "Ticket cannot be scanned outside event dates";
                extraData = baseExtraData;
            }
        } else {
            const sessionDate = moment.tz(booking.eventSession.date, "Asia/Kolkata").startOf("day");
            if (!now.isSame(sessionDate, "day")) {
                result = "invalid";
                responseMsg = "Ticket not valid for today";
                extraData = baseExtraData;
            }
        }

        // Session status check for normal tickets
        if (!ticket.validForAllDays && !ticket.isVipTicket && result === "valid") {
            if (booking.eventSession?.status === "cancelled") {
                result = "invalid";
                responseMsg = "This event session has been cancelled";
                extraData = baseExtraData;
            } else if (booking.eventSession?.status === "completed") {
                result = "invalid";
                responseMsg = "This event session has already been completed";
                extraData = baseExtraData;
            }
        }

        // Ticket active/payment check
        if (ticket.status !== "generated" && result === "valid") {
            result = "invalid";
            responseMsg = "Ticket not active";
            extraData = baseExtraData;
        } else if (booking.paymentStatus !== "paid" && result === "valid") {
            result = "invalid";
            responseMsg = "Payment not verified";
            extraData = baseExtraData;
        }

        // ---------- Scan processing ----------
        if (result === "valid") {
            const scanDate = (ticket.isVipTicket || ticket.validForAllDays)
                ? now.clone().startOf("day")
                : moment.tz(booking.eventSession.date, "Asia/Kolkata");

            const scanWindowStart = scanDate.clone().hour(18).minute(0).second(0);
            const scanWindowEnd = scanDate.clone().hour(23).minute(50).second(0);

            if (!now.isBetween(scanWindowStart, scanWindowEnd, undefined, '[]')) {
                result = "invalid";
                responseMsg = `Ticket can only be scanned between 6:30 PM and 11:50 PM`;
                extraData = baseExtraData;
            } else {
                const alreadyScannedToday = ticket.scanHistory.some(scan =>
                    moment(scan.scannedAt).tz("Asia/Kolkata").isSame(scanDate, "day")
                );

                if (alreadyScannedToday) {
                    result = "already_scanned";
                    responseMsg = "Ticket already used for today";
                    const lastScan = ticket.scanHistory[ticket.scanHistory.length - 1];
                    extraData = {
                        ...baseExtraData,
                        scannedAt: lastScan?.scannedAt
                    };
                } else {
                    ticket.scanHistory.push({ scannedAt: now, session: booking.eventSession._id });
                    if (!ticket.isVipTicket && !ticket.validForAllDays) {
                        ticket.scanned = true;
                        ticket.scannedAt = now;
                    }

                    await booking.save({ session });

                    extraData = {
                        ...baseExtraData,
                        scannedAt: now,
                    };
                }
            }
        }

        // Save scan log
        await GatekeeperScan.create(
            [{
                gatekeeper: gatekeeperId,
                ticketId,
                eventSession: booking.eventSession,
                ticketRef: ticket._id,
                event: booking.event,
                result,
                notes: responseMsg
            }],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return successRes(
            res,
            result === "valid" ? 200 : 400,
            result === "valid",
            responseMsg,
            extraData || {}
        );

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(err.message, 500));
    }
});



// 📌 Get Scanned History
exports.getScannedHistory = catchAsync(async (req, res, next) => {
    const gatekeeperId = req.user?._id;

    if (!gatekeeperId) {
        return next(new AppError("Unauthorized - Gatekeeper required", 401));
    }

    const {
        eventId,
        sessionId,
        search,
        result,
        page = 1,
        limit = 10,
        sortBy = "scannedAt",
        sortOrder = "desc"
    } = req.query;

    const filters = { gatekeeper: gatekeeperId, isDeleted: false };

    // 🎯 event/session filter
    if (eventId) filters["event"] = eventId;
    if (sessionId) filters["eventSession"] = sessionId;

    // 🎯 search filter
    if (search) {
        filters.ticketId = { $regex: search, $options: "i" };
    }

    // 🎯 result filter mapping
    if (result) {
        const resultMap = {
            valid: "valid",
            invalid: "not_found",
            already_used: "already_scanned"
        };
        filters.result = resultMap[result] || result;
    }

    // sorting & pagination
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const perPage = parseInt(limit);

    // 🔎 fetch scans
    const scans = await GatekeeperScan.find(filters)
        .populate({
            path: "eventSession",
            select: "specialNameOfDay date startTime endTime"
        })
        .populate({
            path: "ticketRef",
            select: "attendeeName", // jo fields chahiye wo select kar
        })
        .populate({
            path: "event",
            select: "title"
        })
        .populate({
            path: "gatekeeper",
            select: "name"
        })
        .sort(sort)
        .skip(skip)
        .limit(perPage)
        .lean();

    // ✅ safe formatting: ticketRef missing hoga to null inject karo
    const formattedScans = scans.map(scan => ({
        ...scan,
        ticketRef: scan.ticketRef
            ? scan.ticketRef
            : {
                attendeeName: null,
                status: "invalid_ticket"
            }
    }));

    const total = await GatekeeperScan.countDocuments(filters);

    return successRes(res, 200, true, "Scanned history fetched", {
        totalDocument: total,
        page: parseInt(page),
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
        scans: formattedScans
    });
});





