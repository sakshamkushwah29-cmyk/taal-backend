const QueryBuilder = require("../../services/queryBuilder");
const User = require("../../models/User");
const AppError = require("../../utils/AppError");
const { successRes } = require("../../utils/responseFormatter");
const sendMail = require("../../utils/sendMail");
const welcomeEventManager = require("../../emailTemplates/welcomeEventManager");
const catchAsync = require("../../utils/catchAsync");

exports.createEventManager = catchAsync(async (req, res, next) => {
    const { name, email, password, phone } = req.body;

    if (!email || !password) {
        return next(new AppError("Email and password are required", 400));
    }

    const qb = new QueryBuilder(User);

    const existingUser = await qb.findOne({ email }).exec();
    if (existingUser) {
        return next(new AppError("User with this email already exists", 400));
    }

    const newUser = await new QueryBuilder(User)
        .create({
            name,
            email,
            passwordHash: password,
            phone,
            role: "event_manager",
            isVerified: true
        })
        .exec();
    let template = welcomeEventManager({ name, email, password, role: "event_manager" });
    sendMail({
        to: email,
        subject: "Welcome to the Event Management Team 🎉",
        template: template
    });

    return successRes(res, 201, true, "Event manager created successfully", newUser);
});

exports.getAllEventManagers = catchAsync(async (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const qb = new QueryBuilder(User) // true = deleted bhi include karo
        .filter({ role: "event_manager" })
        .sort("-createdAt")
        .paginate(page, limit);

    const eventManagers = await qb.exec();
    const totalDocument = await qb.count();
    const totalPages = Math.ceil(totalDocument / limit);

    return successRes(res, 200, true, "Event managers retrieved successfully", {
        data: eventManagers,
        totalDocument,
        totalPages,
        pageNo: page,
        limit
    });
});

exports.getEventManager = catchAsync(async (req, res, next) => {
    const { managerId } = req.query;
    const qb = new QueryBuilder(User);
    const eventManager = await qb.findOne({ _id: managerId, role: "event_manager" }).exec();
    if (!eventManager) {
        return next(new AppError("Event manager not found", 404));
    }
    return successRes(res, 200, true, "Event manager retrieved successfully", eventManager);
});

exports.blockUnblockManager = catchAsync(async (req, res, next) => {
    const { managerId } = req.body;
    const qb = new QueryBuilder(User);
    const eventManager = await qb.findOne({ _id: managerId, role: "event_manager" }).exec();
    if (!eventManager) {
        return next(new AppError("Event manager not found", 404));
    }
    eventManager.isBlocked = !eventManager.isBlocked;
    await eventManager.save();
    return successRes(res, 200, true, "Event manager updated successfully", eventManager);
});

exports.updateManagerProfile = catchAsync(async (req, res, next) => {
    const { name, email, phone, managerId } = req.body;
    const qb = new QueryBuilder(User);
    const eventManager = await qb.findOne({ _id: managerId, role: "event_manager" }).exec();
    if (!eventManager) {
        return next(new AppError("Event manager not found", 404));
    }
    if (eventManager.isBlocked) return next(new AppError("This account is blocked", 401));
    eventManager.name = name;
    eventManager.email = email;
    eventManager.phone = phone;
    await eventManager.save();
    return successRes(res, 200, true, "Event manager updated successfully", eventManager);
});

exports.deleteEventManager = catchAsync(async (req, res, next) => {
    const managerId = req?.body?.managerId;
    if (!managerId) return next(new AppError("Manager id is required", 400));
    const qb = new QueryBuilder(User);
    const eventManager = await qb.findOne({ _id: managerId, role: "event_manager" }).exec();
    if (!eventManager) {
        return next(new AppError("Event manager not found", 404));
    }
    eventManager.isDeleted = true;
    eventManager.deletedAt = Date.now();
    await eventManager.save();
    return successRes(res, 200, true, "Event manager deleted successfully", eventManager);
});

exports.searchEventManager = catchAsync(async (req, res, next) => {
    const { search } = req.query;
    const qb = new QueryBuilder(User)
        .filter({ role: "event_manager" })
        .search(search, ["name", "email", "phone"]);
    const eventManagers = await qb.exec();
    return successRes(res, 200, true, "Event managers retrieved successfully", eventManagers);
});



