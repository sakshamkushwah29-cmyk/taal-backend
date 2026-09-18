const User = require("../../models/User");
const Address = require("../../models/Address");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");
const { successRes } = require("../../utils/responseFormatter");
const { signToken } = require("../../utils/jwt");
const bcrypt = require('bcryptjs');
const buildAggregationPipeline = require("../../utils/buildAggregationPipeline");
const UserService = require("../../services/userServices");
const { default: mongoose } = require("mongoose");
const QueryBuilder = require("../../services/queryBuilder");
const ENVIRONMENT = require("../../config/env");

exports.createUser = catchAsync(async (req, res, next) => {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return next(new AppError("Name, Email, Phone, and Password are required", 400));
    }

    const user = await UserService.createUser({ name, email, phone, password });

    return successRes(res, 201, true, "User created successfully", user);
});

exports.uploadAvatar = catchAsync(async (req, res, next) => {
    let file = req.file;
    let fileUrl = `${ENVIRONMENT.IMAGE_FILE_PATH}/userAvatar/${file.filename}`;
    let response = {
        ...file,
        url: fileUrl,
    }
    return successRes(res, 201, true, "File uploaded successfully", response);
});


exports.verifyEmailWithLink = catchAsync(async (req, res, next) => {
    const { token } = req.body;
    const user = await UserService.verifyEmailWithLink(token);
    return successRes(res, 200, true, "Email verified successfully", user);
});

exports.resendVerificationEmail = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) return next(new AppError("Email is required", 400));
    const result = await UserService.resendVerificationEmail(email);
    return successRes(res, 200, true, "Verification email sent successfully", result);
});

exports.loginUser = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError("Please provide email and password", 400));
    }

    const qb = new QueryBuilder(User);
    const user = await qb.findOne({ email }).select('+passwordHash').exec();
    if (!user || !(await user.comparePassword(password))) {
        return next(new AppError("Invalid email or password", 401));
    }

    if (!user.isVerified) return next(new AppError("Please verify your email", 401));

    if (user.isBlocked) return next(new AppError("Your account has been blocked", 401));

    const token = signToken(user._id, user.email, user.role);

    return successRes(res, 200, true, "Login successful", { user, token });
});

exports.loginAdmin = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError("Please provide email and password", 400));
    }

    const qb = new QueryBuilder(User);
    const user = await qb.findOne({ email }).select('+passwordHash').exec();
    if (!user || !(await user.comparePassword(password))) {
        return next(new AppError("Invalid email or password", 401));
    }

    const allowedRoles = ['superadmin', 'event_manager', 'gatekeeper'];
    if (!allowedRoles.includes(user.role)) {
        return next(new AppError("You are not authorized to access the admin panel", 403));
    }

    if (user.isBlocked) return next(new AppError("Your account has been blocked", 401));

    const token = signToken(user._id, user.email, user.role);

    return successRes(res, 200, true, "Login successful", { user, token });
});

exports.getUserProfile = catchAsync(async (req, res, next) => {
    const userId = req?.user?.id;

    if (!userId) return next(new AppError("User not found", 404));

    const aggregationPipeline = buildAggregationPipeline({
        match: { _id: new mongoose.Types.ObjectId(userId) },
        lookups: [
            {
                from: "addresses",
                localField: "addresses",
                foreignField: "_id",
                as: "addresses"
            }
        ],
        project: {
            passwordHash: 0,
            verificationToken: 0,
            __v: 0
        },
        limit: 1
    });

    const user = await User.aggregate(aggregationPipeline);

    if (!user || user.length === 0) {
        return next(new AppError("User profile not found", 404));
    }

    return successRes(res, 200, true, "User profile retrieved successfully", user[0]);
});

exports.updateUserProfile = catchAsync(async (req, res, next) => {
    const userId = req?.user?.id;
    const { name, email, phone } = req.body;

    if (!userId) return next(new AppError("User not found", 404));

    const user = await User.findByIdAndUpdate(userId, { name, email, phone }, { new: true });

    return successRes(res, 200, true, "User profile updated successfully", user);
});

exports.changePassword = catchAsync(async (req, res, next) => {
    const userId = req?.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) return next(new AppError("User not found", 404));

    const user = await User.findById(userId).select("+passwordHash");

    if (!user) return next(new AppError("User not found", 404));

    if (!(await user.comparePassword(currentPassword))) {
        return next(new AppError("Current password is incorrect", 401));
    }

    user.passwordHash = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    return successRes(res, 200, true, "Password changed successfully", null);
});

exports.forgetPassowrd = catchAsync(async (req, res, next) => {
    const email = req?.body?.email;
    if (!email) return next(new AppError("Email is required", 400));
    const user = await UserService.forgetPassowrd(email);
    return successRes(res, 200, true, "Password reset link sent successfully", null);
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    const { token, password } = req.body;
    const user = await UserService.resetPassword(token, password);
    return successRes(res, 200, true, "Password reset successfully", null);
});