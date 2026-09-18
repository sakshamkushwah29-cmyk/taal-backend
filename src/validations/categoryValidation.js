const Joi = require("joi");

const createCategoryValidation = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().trim().min(5).max(500).required(),
    icon: Joi.string().uri().allow("").optional(),
    parent: Joi.string().hex().length(24).optional(), // MongoDB ObjectId
    isActive: Joi.boolean().default(true)
});

const getCategoryValidation = Joi.object({
    categoryId: Joi.string().hex().length(24).required()
});

const updateCategoryValidation = Joi.object({
    categoryId: Joi.string().hex().length(24).required(),
    name: Joi.string().trim().min(2).max(100).optional(),
    description: Joi.string().trim().min(5).max(500).optional(),
    icon: Joi.string().uri().allow("").optional(),
    parent: Joi.string().hex().length(24).optional(), // MongoDB ObjectId
    isActive: Joi.boolean().optional()
});

const deleteCategoryValidation = Joi.object({
    categoryId: Joi.string().hex().length(24).required()
});

module.exports = { createCategoryValidation, getCategoryValidation, updateCategoryValidation, deleteCategoryValidation };