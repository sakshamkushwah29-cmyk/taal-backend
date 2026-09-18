const Joi = require("joi");

const mongoose = require('mongoose');

const objectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message('"{{#label}}" must be a valid ObjectId');
    }
    return value;
};

module.exports = {
    rentNowValidation: Joi.object({
        productId: Joi.string().custom(objectId).required(),
        variantId: Joi.string().custom(objectId).required(),
        qty: Joi.number().integer().min(1).default(1),
        startDate: Joi.date().iso().required()
            .messages({ 'date.format': 'startDate must be in ISO format (YYYY-MM-DD)' }),
        endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
            .messages({ 'date.greater': 'endDate must be greater than startDate' }),
        addressId: Joi.string().custom(objectId).required(),
        paymentMethod: Joi.string().valid('cod', 'online').required(),
        gateway: Joi.string().valid('razorpay', 'stripe').default('razorpay')
    }),
    addRentalCartValidation: Joi.object({
        productId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error("any.invalid");
                }
                return value;
            })
            .messages({
                "any.required": "productId is required",
                "any.invalid": "Invalid productId"
            }),

        variantId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error("any.invalid");
                }
                return value;
            })
            .messages({
                "any.required": "variantId is required",
                "any.invalid": "Invalid variantId"
            }),

        qty: Joi.number()
            .integer()
            .min(1)
            .default(1)
            .messages({
                "number.base": "Qty must be a number",
                "number.min": "Qty must be at least 1"
            }),

        startDate: Joi.date()
            .optional()
            .messages({
                "date.base": "startDate must be a valid date"
            }),

        endDate: Joi.date()
            .optional()
            .greater(Joi.ref("startDate"))
            .messages({
                "date.base": "endDate must be a valid date",
                "date.greater": "endDate must be greater than startDate"
            }),
    })

}

