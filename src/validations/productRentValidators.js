// validators/productRentValidators.js
const Joi = require('joi');
const mongoose = require('mongoose');

const variantSchema = Joi.object({
    _id: Joi.string().hex().length(24).optional(),
    color: Joi.string().required(),
    size: Joi.string().default('free'),
    sku: Joi.string().allow('', null).optional(),
    price: Joi.number().min(0).required(),
    discountPrice: Joi.number().min(0).default(0),
    stock: Joi.number().integer().min(0).default(0),
    images: Joi.array().items(Joi.string().allow('', null)).default([])
});


module.exports = {
    createProductSchema: Joi.object({
        title: Joi.string().required(),
        sku: Joi.string().optional().allow('', null),
        description: Joi.string().allow('', null).default(''),
        rentPricePerDay: Joi.number().min(0).required(),
        deposit: Joi.number().min(0).default(0),
        currency: Joi.string().default('INR'),
        variants: Joi.array().items(variantSchema).default([]),
        tags: Joi.array().items(Joi.string()).required(),
        status: Joi.string().valid('active', 'inactive').default('active'),
        category: Joi.string().hex().length(24).required(),
        gender: Joi.string().valid("men", "women", "boys", "girls", "unisex", "all").default("unisex")
    }),

    updateProductSchema: Joi.object({
        productId: Joi.string().hex().length(24).required(),
        title: Joi.string().optional(),
        sku: Joi.string().optional().allow('', null),
        description: Joi.string().optional().allow('', null),
        rentPricePerDay: Joi.number().min(0).optional(),
        deposit: Joi.number().min(0).optional(),
        currency: Joi.string().optional(),
        variants: Joi.array().items(variantSchema).optional(),
        tags: Joi.array().items(Joi.string()).optional(),
        status: Joi.string().valid('active', 'inactive').optional(),
        category: Joi.string().hex().length(24).optional(),
        gender: Joi.string().valid("men", "women", "boys", "girls", "unisex", "all").optional()
    }),

    listQuerySchema: Joi.object({
        search: Joi.string().optional().allow('', null),
        category: Joi.string().hex().length(24).optional(),
        status: Joi.string().valid('active', 'inactive').optional(),
        minPrice: Joi.number().min(0).optional(),
        maxPrice: Joi.number().min(0).optional(),
        tags: Joi.string().optional(), // comma-separated
        sort: Joi.string().optional().default('-createdAt'),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(200).default(20)
    }),

    addVariantSchema: Joi.object({
        color: Joi.string().required(),
        size: Joi.string().default('free'),
        sku: Joi.string().optional().allow('', null),
        price: Joi.number().min(0).required(),
        discountPrice: Joi.number().min(0).default(0),
        stock: Joi.number().integer().min(0).default(0),
        images: Joi.array().items(Joi.string().allow('', null)).default([])
    }),

    updateVariantSchema: Joi.object({
        color: Joi.string().optional(),
        size: Joi.string().optional(),
        sku: Joi.string().optional().allow('', null),
        price: Joi.number().min(0).optional(),
        discountPrice: Joi.number().min(0).optional(),
        stock: Joi.number().integer().min(0).optional(),
        images: Joi.array().items(Joi.string().allow('', null)).optional()
    }),

    adjustStockSchema: Joi.object({
        delta: Joi.number().integer().required() // negative to decrement, positive to increment
    }),

    changeProductStatusValidation: Joi.object({
        productId: Joi.string().hex().length(24).required(),
        status: Joi.string().valid("active", "inactive", "draft").required()
    })
};
