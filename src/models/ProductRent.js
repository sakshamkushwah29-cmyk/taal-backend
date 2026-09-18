// models/ProductRent.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');
const { default: slugify } = require('slugify');
const generateSKU = require('../utils/generateSKU');

const VariantSchema = new Schema({
    _id: { type: Schema.Types.ObjectId, auto: true },
    color: { type: String, required: true },
    size: { type: String, default: 'free' },
    sku: { type: String }, // validated unique within product (see pre-validate)
    price: { type: Number, required: true },
    discountPrice: { type: Number, default: 0 },
    stock: { type: Number, default: 0, min: 0 },
    images: { type: [String], default: [] }
}, { _id: true });

const ProductRentSchema = new Schema({
    title: { type: String, required: true, trim: true },
    sku: { type: String, index: true },
    description: { type: String, default: '' },
    rentPricePerDay: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    variants: { type: [VariantSchema], default: [] },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    totalStock: { type: Number, default: 0, min: 0 },
    gender: { type: String, enum: ["men", "women", 'boys', 'girls', "unisex", "all"] },
}, { timestamps: true });

ProductRentSchema.pre("save", function (next) {
    if (!this.slug && this.title) {
        this.slug = slugify(this.title, { lower: true, strict: true });
    }
    this.variants.forEach(variant => {
        if (!variant.sku) {
            variant.sku = generateSKU(`${this.title}-${variant.color}-${variant.size}`);
        }
    });
    next();
});

softDelete(ProductRentSchema);

module.exports = mongoose.model('ProductRent', ProductRentSchema);
