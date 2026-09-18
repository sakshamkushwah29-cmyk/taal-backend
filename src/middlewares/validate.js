const AppError = require("../utils/AppError");

// Body Validator
const validateBody = (schema) => {
    return (req, res, next) => {
        if (!req.body) return next(new AppError("Request body is missing", 400));

        const { error } = schema.validate(req.body, { abortEarly: true });
        if (error) {
            const cleanMessage = error.details[0].message.replace(/"/g, "");
            return next(new AppError(cleanMessage, 400));
        }

        next();
    };
};

// Query Validator
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.query, { abortEarly: true });
        if (error) {
            const cleanMessage = error.details[0].message.replace(/"/g, "");
            return next(new AppError(cleanMessage, 400));
        }
        next();
    };
};

// Params Validator
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.params, { abortEarly: true });
        if (error) {
            const cleanMessage = error.details[0].message.replace(/"/g, "");
            return next(new AppError(cleanMessage, 400));
        }
        next();
    };
};

module.exports = {
    validateBody,
    validateQuery,
    validateParams,
};
