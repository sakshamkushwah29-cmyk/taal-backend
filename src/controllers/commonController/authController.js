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

const { uploadToCloudinary } = require("../../services/cloudinaryService");

exports.uploadAvatar = catchAsync(async (req, res, next) => {
    let file = req.file;
    if (!file) return next(new AppError("No file uploaded", 400));
    let url;
    try {
        url = await uploadToCloudinary(file.path, "userAvatar");
    } catch (err) {
        console.error("Cloudinary upload failed for avatar, fallback to local URL:", err);
        url = `${ENVIRONMENT.IMAGE_FILE_PATH || "https://taal-backend-yjs9.onrender.com/uploads"}/userAvatar/${file.filename}`;
    }
    let response = {
        ...file,
        url,
    };
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

let clerkClient = null;
try {
    const { createClerkClient } = require("@clerk/backend");
    if (ENVIRONMENT.CLERK_SECRET_KEY) {
        clerkClient = createClerkClient({
            secretKey: ENVIRONMENT.CLERK_SECRET_KEY,
            publishableKey: ENVIRONMENT.CLERK_PUBLISHABLE_KEY
        });
    }
} catch (e) {
    console.warn("Clerk backend client initialization skipped:", e.message);
}

exports.syncClerkUser = catchAsync(async (req, res, next) => {
    let { clerkId, email, name, phone, profilePic } = req.body;

    if (!clerkId && !email) {
        return next(new AppError("clerkId or email is required", 400));
    }

    // Optionally fetch user info directly from Clerk if needed
    if (clerkClient && clerkId && (!email || !name)) {
        try {
            const clerkUser = await clerkClient.users.getUser(clerkId);
            if (clerkUser) {
                if (!email && clerkUser.emailAddresses?.length > 0) {
                    email = clerkUser.emailAddresses[0].emailAddress;
                }
                if (!name) {
                    name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username;
                }
                if (!profilePic && clerkUser.imageUrl) {
                    profilePic = clerkUser.imageUrl;
                }
                if (!phone && clerkUser.phoneNumbers?.length > 0) {
                    phone = clerkUser.phoneNumbers[0].phoneNumber;
                }
            }
        } catch (clerkErr) {
            console.warn("Could not fetch user details from Clerk API:", clerkErr.message);
        }
    }

    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    let user = null;
    if (clerkId) {
        user = await User.findOne({ clerkId });
    }
    if (!user && normalizedEmail) {
        user = await User.findOne({ email: normalizedEmail });
    }

    if (user) {
        let modified = false;
        if (!user.clerkId && clerkId) {
            user.clerkId = clerkId;
            modified = true;
        }
        if (!user.isVerified) {
            user.isVerified = true;
            modified = true;
        }
        if (name && (!user.name || user.name === "User")) {
            user.name = name;
            modified = true;
        }
        if (profilePic && !user.profilePic) {
            user.profilePic = profilePic;
            modified = true;
        }
        if (phone && !user.phone) {
            user.phone = phone;
            modified = true;
        }
        if (modified) {
            await user.save();
        }
    } else {
        user = await User.create({
            name: name || (normalizedEmail ? normalizedEmail.split("@")[0] : "User"),
            email: normalizedEmail,
            phone: phone || undefined,
            profilePic: profilePic || undefined,
            clerkId,
            isVerified: true,
            signupMethod: "clerk",
            role: "user",
        });
    }

    if (user.isBlocked) {
        return next(new AppError("Your account has been blocked", 403));
    }

    const token = signToken(user._id, user.email, user.role);

    return successRes(res, 200, true, "User synchronized successfully", { user, token });
});