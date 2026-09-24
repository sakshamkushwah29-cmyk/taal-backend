const { default: mongoose } = require("mongoose");
const Event = require("../../models/Event");
const EventSession = require("../../models/EventSession");
const QueryBuilder = require("../../services/queryBuilder");
const catchAsync = require("../../utils/catchAsync");
const { successRes } = require("../../utils/responseFormatter");
const AppError = require("../../utils/AppError");
const GatekeeperScan = require("../../models/GatekeeperScan");
const ENVIRONMENT = require("../../config/env.js");

const { uploadToCloudinary } = require("../../services/cloudinaryService");

exports.uploadBannerImage = catchAsync(async (req, res, next) => {
    let file = req.file;
    if (!file) return next(new AppError("No file uploaded", 400));
    let url;
    try {
        url = await uploadToCloudinary(file.path, "eventBanners");
    } catch (err) {
        console.error("Cloudinary upload failed for banner, fallback to local URL:", err);
        url = `${ENVIRONMENT.IMAGE_FILE_PATH || "https://taal-backend-yjs9.onrender.com/uploads"}/eventBanners/${file.filename}`;
    }
    let response = {
        ...file,
        url,
    };
    return successRes(res, 201, true, "File uploaded successfully", response);
});

exports.uploadEventImages = catchAsync(async (req, res, next) => {
    let files = req.files;
    if (!files || files.length === 0) {
        return successRes(res, 400, false, "No files uploaded");
    }

    let response = await Promise.all(
        files.map(async (file) => {
            let url;
            try {
                url = await uploadToCloudinary(file.path, "eventImages");
            } catch (err) {
                console.error("Cloudinary upload failed for event image, fallback to local URL:", err);
                url = `${ENVIRONMENT.IMAGE_FILE_PATH || "https://taal-backend-yjs9.onrender.com/uploads"}/eventImages/${file.filename}`;
            }
            return {
                originalName: file.originalname,
                fileName: file.filename,
                mimeType: file.mimetype,
                size: file.size,
                url,
            };
        })
    );

    return successRes(res, 201, true, "Files uploaded successfully", response);
});

exports.createEvent = catchAsync(async (req, res, next) => {
    const { title, slug, description, venueName, address, images, banner, startDate, endDate, createdBy } = req.body;
    const event = await new Event({ title, slug, description, venueName, address, images, banner, startDate, endDate, createdBy }).save();
    return successRes(res, 201, true, "Event created successfully", event);
});

//get all events with sessions
exports.getAllEvents = catchAsync(async (req, res, next) => {
    let status = req.query?.status;
    const qb = new QueryBuilder(Event);

    // Base match filter
    let matchFilter = { isDeleted: false };

    if (status !== undefined) {
        matchFilter.isActive = status === "true";
    }

    qb.aggregate([
        {
            $match: matchFilter
        },
        {
            $lookup: {
                from: "eventsessions",
                let: { eventId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$event", "$$eventId"] },
                                    { $eq: ["$isDeleted", false] }
                                ]
                            }
                        }
                    },
                    {
                        $sort: { date: 1 } // ✅ Sort sessions by "date" ascending
                    }
                ],
                as: "sessions"
            }
        },
        {
            $sort: { createdAt: -1 } // events ko latest pehle dikhana hai
        }
    ]);

    const events = await qb.query;

    return successRes(res, 200, true, "Events with sessions retrieved successfully", events);
});



//get event by is with sessions
exports.getEvent = catchAsync(async (req, res, next) => {
    const eventId = req.query?.eventId;
    if (!eventId) return next(new AppError("Event id is required", 400));

    const qb = new QueryBuilder(Event);
    qb.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(eventId),
                isDeleted: false // ✅ Event filter
            }
        },
        {
            $lookup: {
                from: "eventsessions",
                let: { eventId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$event", "$$eventId"] },
                                    { $eq: ["$isDeleted", false] } // ✅ Session filter
                                ]
                            }
                        }
                    },
                    {
                        $sort: { date: 1 } // ✅ Sort sessions by date ascending
                    }
                ],
                as: "sessions"
            }
        }
    ]);

    const event = await qb.query;

    return successRes(res, 200, true, "Event retrieved successfully", event);
});


exports.changeEventStatus = catchAsync(async (req, res, next) => {
    const eventId = req.body?.eventId;
    const isActive = req.body?.isActive;
    if (!eventId) return next(new AppError("Event id is required", 400));
    if (![true, false].includes(isActive)) return next(new AppError("Invalid isActive value", 400));
    let qb = new QueryBuilder(Event);
    const event = await qb.findOne({ _id: eventId }).exec();
    if (!event) {
        return next(new AppError("Event not found", 404));
    }
    event.isActive = isActive;
    await event.save();
    return successRes(res, 200, true, "Event status updated successfully", null);
})

exports.updateEvent = catchAsync(async (req, res, next) => {
    const { eventId, title, slug, description, venueName, address, images, banner, startDate, endDate } = req.body;
    if (!eventId) return next(new AppError("Event id is required", 400));
    let qb = new QueryBuilder(Event);
    const event = await qb.findOne({ _id: eventId }).exec();
    if (!event) {
        return next(new AppError("Event not found", 404));
    }
    event.title = title;
    event.slug = slug;
    event.description = description;
    event.venueName = venueName;
    event.address = address;
    event.images = images;
    event.banner = banner;
    event.startDate = startDate;
    event.endDate = endDate;
    await event.save();
    return successRes(res, 200, true, "Event updated successfully", null);
});

exports.deleteEvent = catchAsync(async (req, res, next) => {
    const eventId = req.body?.eventId;
    if (!eventId) return next(new AppError("Event id is required", 400));

    let qb = new QueryBuilder(Event);
    const event = await qb.findOne({ _id: eventId }).exec();

    if (!event) {
        return next(new AppError("Event not found", 404));
    }

    // ✅ Soft delete event
    event.isDeleted = true;
    event.deletedAt = Date.now();
    await event.save();

    // ✅ Soft delete all related sessions
    await EventSession.updateMany(
        { event: eventId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: Date.now() } }
    );

    return successRes(res, 200, true, "Event and related sessions deleted successfully", null);
});

exports.createEventSession = catchAsync(async (req, res, next) => {
    const createdBy = req.user._id;
    const sessionsData = req.body; // Always array (validated by Joi)

    // ✅ Check if event exists & get details
    const eventIds = [...new Set(sessionsData.map(s => s.event))];
    const events = await Event.find({ _id: { $in: eventIds } });

    if (events.length !== eventIds.length) {
        return next(new AppError("One or more events not found", 404));
    }

    function normalizeDate(date) {
        return new Date(date.toISOString().split("T")[0]); // removes time, works in UTC
    }

    // ✅ Duplicate check in request body itself
    const seen = new Set();
    for (let session of sessionsData) {
        const event = events.find(e => e._id.toString() === session.event);
        const startDate = normalizeDate(event.startDate);
        const endDate = normalizeDate(event.endDate);
        const sessionDate = normalizeDate(new Date(session.date));

        if (sessionDate < startDate || sessionDate > endDate) {
            return next(
                new AppError(`Session date ${session.date} is outside event date range`, 400)
            );
        }

        const key = `${session.event}_${sessionDate.toISOString()}_${session.startTime}_${session.endTime}`;
        if (seen.has(key)) {
            return next(
                new AppError(`Please provide unique sessions for date ${session.date}`, 400)
            );
        }
        seen.add(key);
    }

    // ✅ Validate remainingCapacity
    for (let session of sessionsData) {
        if (session.remainingCapacity > session.totalCapacity) {
            return next(
                new AppError(
                    `Remaining capacity cannot be greater than total capacity for event session ${session.specialNameOfDay} on ${session.date}`,
                    400
                )
            );
        }
    }

    // ✅ Check duplicates in DB
    for (let session of sessionsData) {
        const sessionDate = normalizeDate(new Date(session.date));

        const existing = await EventSession.findOne({
            event: session.event,
            date: sessionDate,
            startTime: session.startTime,
            endTime: session.endTime,
            isDeleted: false
        });

        if (existing) {
            return next(
                new AppError(
                    `Session already exists for event on ${session.date} with same timings`,
                    400
                )
            );
        }
    }

    // ✅ Add createdBy to each session
    const sessionsToInsert = sessionsData.map(session => ({
        ...session,
        createdBy
    }));

    // ✅ Bulk insert
    const insertedSessions = await EventSession.insertMany(sessionsToInsert);

    return successRes(res, 201, true, "Event sessions created successfully", insertedSessions);
});

exports.getEventSessionBySessionId = catchAsync(async (req, res, next) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return next(new AppError("Session id is required", 400));
    }

    const qb = new QueryBuilder(EventSession);
    qb.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(sessionId),
                isDeleted: false
            }
        },
        {
            $lookup: {
                from: "events", // events collection
                localField: "event",
                foreignField: "_id",
                as: "eventDetails"
            }
        },
        { $unwind: "$eventDetails" } // Single object instead of array
    ]);

    const session = await qb.query;

    if (!session.length) {
        return next(new AppError("Event session not found", 404));
    }

    return successRes(res, 200, true, "Event session found successfully", session[0]);
});

exports.deleteEventSession = catchAsync(async (req, res, next) => {
    const sessionId = req.body?.sessionId;
    if (!sessionId) return next(new AppError("Session id is required", 400));
    const qb = new QueryBuilder(EventSession);
    const session = await qb.findOne({ _id: sessionId }).exec();
    if (!session) {
        return next(new AppError("Event session not found", 404));
    }
    session.isDeleted = true;
    session.deletedAt = Date.now();
    await session.save();
    return successRes(res, 200, true, "Event session deleted successfully", session);
});

exports.changeEventSessionStatus = catchAsync(async (req, res, next) => {
    const sessionId = req.body?.sessionId;
    const sessionStatus = req.body?.sessionStatus;
    if (!sessionId) return next(new AppError("Session id is required", 400));
    if (!['scheduled', 'cancelled', 'completed'].includes(sessionStatus)) return next(new AppError("Invalid sessionStatus value", 400));
    const qb = new QueryBuilder(EventSession);
    const session = await qb.findOne({ _id: sessionId }).exec();
    if (!session) {
        return next(new AppError("Event session not found", 404));
    }
    session.status = sessionStatus;
    await session.save();
    return successRes(res, 200, true, "Event session status updated successfully", session);
})

/** Get Gatekeeper Scan History */

exports.getGatekeeperScannedHistory = catchAsync(async (req, res, next) => {
    const gatekeeperId = req.query?.gatekeeperId;

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

    const filters = { isDeleted: false };
    if (gatekeeperId) {
        filters.gatekeeper = gatekeeperId;
    }

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


exports.updateEventSession = catchAsync(async (req, res, next) => {
    const { sessionId, ...updateFields } = req.body;

    if (!sessionId) {
        return next(new AppError("sessionId is required", 400));
    }

    // ✅ Find the session
    const session = await EventSession.findById(sessionId);
    if (!session) {
        return next(new AppError("Event session not found", 404));
    }

    // ✅ Optional: Check date within event range if date is provided
    if (updateFields.date) {
        const event = await Event.findById(session.event);
        if (!event) {
            return next(new AppError("Associated event not found", 404));
        }

        const normalizeDate = (date) => new Date(date.toISOString().split("T")[0]);
        const sessionDate = normalizeDate(new Date(updateFields.date));

        if (sessionDate < normalizeDate(event.startDate) || sessionDate > normalizeDate(event.endDate)) {
            return next(new AppError("Session date is outside event date range", 400));
        }

        updateFields.date = sessionDate;
    }

    // ✅ Validate remainingCapacity <= totalCapacity if both are provided
    if (updateFields.totalCapacity !== undefined && updateFields.remainingCapacity !== undefined) {
        if (updateFields.remainingCapacity > updateFields.totalCapacity) {
            return next(
                new AppError("Remaining capacity cannot be greater than total capacity", 400)
            );
        }
    }

    // ✅ Optional: Check duplicate session for same event, date, and time
    if (updateFields.date || updateFields.startTime || updateFields.endTime) {
        const existing = await EventSession.findOne({
            _id: { $ne: sessionId },
            event: session.event,
            date: updateFields.date || session.date,
            startTime: updateFields.startTime || session.startTime,
            endTime: updateFields.endTime || session.endTime,
            isDeleted: false
        });

        if (existing) {
            return next(
                new AppError("Another session exists for the same date and time", 400)
            );
        }
    }

    // ✅ Update only the provided fields
    Object.keys(updateFields).forEach(key => {
        session[key] = updateFields[key];
    });

    await session.save();

    return successRes(res, 200, true, "Event session updated successfully", session);
});



exports.updateEventSessionStatus = catchAsync(async (req, res, next) => {

    console.log(req.body, "req.body");
    const { sessionId, status } = req.body;

    if (!sessionId || !status) {
        return next(new AppError("sessionId and status are required", 400));
    }

    if (!["scheduled", "cancelled", "completed"].includes(status)) {
        return next(new AppError("Invalid status value", 400));
    }

    const session = await EventSession.findById(sessionId);
    if (!session) {
        return next(new AppError("Event session not found", 404));
    }

    session.status = status;
    await session.save();

    return successRes(res, 200, true, "Event session status updated successfully", session);
})