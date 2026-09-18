// validations/productValidations.js
const Joi = require("joi");

const createProductSchema = Joi.object({
    title: Joi.string().trim().required(),
    description: Joi.string().allow('').optional(),
    category: Joi.string().required(),
    tags: Joi.array().items(Joi.string().trim()).default([]),

    variants: Joi.array()
        .items(
            Joi.object({
                color: Joi.string().trim().required(),
                size: Joi.string().trim().required(),
                price: Joi.number().positive().required(),
                // allow 0..price (0 means free) — we will treat undefined specially below
                discountPrice: Joi.number().min(0).max(Joi.ref('price')).optional(),
                stock: Joi.number().integer().min(0).default(0),
                images: Joi.array().items(Joi.string().uri()).max(10).default([]),
                sku: Joi.string().trim().optional()
            })
        )
        .min(1)
        .required()
        // Optionally ensure provided SKUs in payload are unique
        .unique((a, b) => {
            const sa = (a.sku || '').toString().trim().toUpperCase();
            const sb = (b.sku || '').toString().trim().toUpperCase();
            return sa && sb && sa === sb;
        }),

    status: Joi.string().valid('active', 'inactive', 'draft').default('active'),
    gender: Joi.string().valid("men", "women", 'boys', 'girls', "unisex", "all").optional()
});

const getProductByIdValidation = Joi.object({
    productId: Joi.string().hex().length(24).required()
});

const updateProductValidation = Joi.object({
    productId: Joi.string().hex().length(24).required(),
    title: Joi.string().trim().optional(),
    description: Joi.string().allow("").optional(),
    category: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    gender: Joi.string().valid("men", "women", 'boys', 'girls', "unisex", "all").optional(),
    variants: Joi.array().items(
        Joi.object({
            color: Joi.string().optional(),
            size: Joi.string().optional(),
            price: Joi.number().positive().optional(),
            discountPrice: Joi.number().positive().optional(),
            stock: Joi.number().integer().min(0).optional(),
            images: Joi.array().items(Joi.string().uri()).default([]),
            sku: Joi.string().optional()
        })
    ).optional(),
    status: Joi.string().valid("active", "inactive", "draft").optional()
});

const changeProductStatusValidation = Joi.object({
    productId: Joi.string().hex().length(24).required(),
    status: Joi.string().valid("active", "inactive", "draft").required()
});

module.exports = { createProductSchema, getProductByIdValidation, updateProductValidation, changeProductStatusValidation };
