const AppError = require("../utils/AppError");

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";

    // Development Mode
    if (process.env.NODE_ENV === "development") {
        return res.status(err.statusCode).json({
            success: false,
            statusCode: err.statusCode,
            message: err.message,
            stack: err.stack,
        });
    }
    // Production Mode: Handle common Mongo & JWT errors
    if (err.name === "CastError") {
        err = new AppError("Invalid ID format", 400);
    }

    if (err.code === 11000) {
        err = new AppError("Duplicate field value", 400);
    }

    if (err.name === "ValidationError") {
        err = new AppError(Object.values(err.errors).map(el => el.message).join(", "), 400);
    }

    if (err.name === "JsonWebTokenError") {
        err = new AppError("Invalid token. Please log in again.", 401);
    }

    if (err.name === "TokenExpiredError") {
        err = new AppError("Token expired. Please log in again.", 401);
    }

    return res.status(err.statusCode).json({
        success: false,
        statusCode: err.statusCode,
        message: err.message || "Something went wrong",
    });
};
