const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const AppError = require("../utils/AppError");
const User = require("../models/User");
const ENVIRONMENT = require("../config/env");

const JWT_SECRET = ENVIRONMENT.JWT_SECRET || "your_jwt_secret_key";
const JWT_EXPIRES_IN = "365d"; // token expiry

// ✅ Sign token
function signToken(userId, email, role) {
    return jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// ✅ Role-based Protect Middleware
const protect = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            let token;
            if (req.headers.authorization?.startsWith("Bearer")) {
                token = req.headers.authorization.split(" ")[1];
            }

            if (!token) {
                return next(new AppError("You are not logged in! Please log in.", 401));
            }

            // ✅ Verify token
            let decoded;
            let findUser;
            try {
                decoded = await promisify(jwt.verify)(token, JWT_SECRET);
                findUser = await User.findById(decoded.id);
            } catch (jwtErr) {
                if (ENVIRONMENT.CLERK_SECRET_KEY) {
                    try {
                        const { verifyToken } = require("@clerk/backend");
                        const clerkPayload = await verifyToken(token, {
                            secretKey: ENVIRONMENT.CLERK_SECRET_KEY,
                        });
                        if (clerkPayload && clerkPayload.sub) {
                            findUser = await User.findOne({ clerkId: clerkPayload.sub });
                            if (findUser) {
                                decoded = { id: findUser._id, email: findUser.email, role: findUser.role, iat: clerkPayload.iat };
                            }
                        }
                    } catch (clerkErr) {
                        // fallback to error throwing below
                    }
                }
                if (!findUser) {
                    throw jwtErr;
                }
            }

            if (!findUser) {
                return next(new AppError("The user belonging to this token does not exist.", 401));
            }

            // ✅ Check if password changed after token was issued
            if (findUser.changedPasswordAfter && findUser.changedPasswordAfter(decoded.iat)) {
                return next(new AppError("User recently changed password! Please log in again.", 401));
            }

            // ✅ Role check
            if (allowedRoles.length && !allowedRoles.includes(findUser.role)) {
                // Allow admin and staff accounts (event_manager, superadmin, gatekeeper) to also perform consumer user actions
                if (allowedRoles.includes("user") && ["superadmin", "event_manager", "gatekeeper"].includes(findUser.role)) {
                    // Allowed as consumer
                } else {
                    return next(new AppError("You do not have permission to perform this action", 403));
                }
            }
            // ✅ Attach user to request
            req.userId = decoded.id;
            req.user = findUser;
            next();
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return next(new AppError("Your token has expired! Please log in again.", 401));
            }
            if (err.name === "JsonWebTokenError") {
                return next(new AppError("Invalid token! Please log in again.", 401));
            }
            return next(new AppError("Authentication failed.", 401));
        }
    };
};

module.exports = {
    signToken,
    protect,
};
