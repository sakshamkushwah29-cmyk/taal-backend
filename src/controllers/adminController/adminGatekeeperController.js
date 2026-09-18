const QueryBuilder = require("../../services/queryBuilder");
const AppError = require("../../utils/AppError");
const { successRes } = require("../../utils/responseFormatter");
const catchAsync = require("../../utils/catchAsync");
const SuperAdminServices = require("../../services/superAdminServices");
const User = require("../../models/User");

exports.createGatekeeper = catchAsync(async (req, res, next) => {
    let creatorId = req.user._id;
    const { name, email, password, phone } = req.body;

    if (!email || !password || !phone || !name) {
        return next(new AppError("Email, Password, Phone, and Name are required", 400));
    }

    let newUser = await SuperAdminServices.createGatekeeper({ name, email, phone, password, creatorId });

    return successRes(res, 201, true, "Gatekeeper created successfully", newUser);
});

exports.getAllGatekeepers = catchAsync(async (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const qb = new QueryBuilder(User) // true = deleted bhi include karo
        .filter({ role: "gatekeeper" })
        .sort("-createdAt")
        .paginate(page, limit);

    const gatekeepers = await qb.exec();
    const totalDocument = await qb.count();
    const totalPages = Math.ceil(totalDocument / limit);

    return successRes(res, 200, true, "Gatekeepers retrieved successfully", {
        data: gatekeepers,
        totalDocument,
        totalPages,
        pageNo: page,
        limit
    });
});

exports.getGatekeeper = catchAsync(async (req, res, next) => {
    const { gatekeeperId } = req.query;
    const qb = new QueryBuilder(User);
    const gatekeeper = await qb.findOne({ _id: gatekeeperId, role: "gatekeeper" }).exec();
    if (!gatekeeper) {
        return next(new AppError("Gatekeeper not found", 404));
    }
    return successRes(res, 200, true, "Gatekeeper retrieved successfully", gatekeeper);
});

exports.blockUnblockGatekeeper = catchAsync(async (req, res, next) => {
    const { gatekeeperId } = req.body;
    const qb = new QueryBuilder(User);
    const gatekeeper = await qb.findOne({ _id: gatekeeperId, role: "gatekeeper" }).exec();
    if (!gatekeeper) {
        return next(new AppError("Gatekeeper not found", 404));
    }
    gatekeeper.isBlocked = !gatekeeper.isBlocked;
    await gatekeeper.save();
    return successRes(res, 200, true, "Gatekeeper updated successfully", gatekeeper);
});

exports.updateGatekeeperProfile = catchAsync(async (req, res, next) => {
    const { name, email, phone, gatekeeperId } = req.body;
    const qb = new QueryBuilder(User);
    const gatekeeper = await qb.findOne({ _id: gatekeeperId, role: "gatekeeper" }).exec();
    if (!gatekeeper) {
        return next(new AppError("Gatekeeper not found", 404));
    }
    if (gatekeeper.isBlocked) return next(new AppError("This account is blocked", 401));
    gatekeeper.name = name;
    gatekeeper.email = email;
    gatekeeper.phone = phone;
    await gatekeeper.save();
    return successRes(res, 200, true, "Gatekeeper updated successfully", gatekeeper);
});

exports.deleteGatekeeper = catchAsync(async (req, res, next) => {
    const gatekeeperId = req?.body?.gatekeeperId;
    if (!gatekeeperId) return next(new AppError("Gatekeeper id is required", 400));
    const qb = new QueryBuilder(User);
    const gatekeeper = await qb.findOne({ _id: gatekeeperId, role: "gatekeeper" }).exec();
    if (!gatekeeper) {
        return next(new AppError("Gatekeeper not found", 404));
    }
    gatekeeper.isDeleted = true;
    gatekeeper.deletedAt = Date.now();
    await gatekeeper.save();
    return successRes(res, 200, true, "Gatekeeper deleted successfully", gatekeeper);
});

exports.searchGateKeeper = catchAsync(async (req, res, next) => {
    const { search } = req.query;
    const qb = new QueryBuilder(User)
        .filter({ role: "gatekeeper" })
        .search(search, ["name", "email", "phone"]);
    const eventManagers = await qb.exec();
    return successRes(res, 200, true, "Event managers retrieved successfully", eventManagers);
});