const mongoose = require('mongoose');
const { Schema } = mongoose;
const slugify = require('slugify');
const softDelete = require('../utils/softDelete');
const generateSKU = require('../utils/generateSKU');

const VariantSchema = new Schema({
    color: { type: String, required: true },   // e.g. "Red"
    size: { type: String, default: "free" },    // e.g. "M", "L"
    sku: { type: String, unique: true },
    price: { type: Number, required: true },
    discountPrice: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    images: [String]
}, { _id: true });

const ProductSaleSchema = new Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, index: true },
    description: String,
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: [String],
    status: { type: String, enum: ["active", "inactive", "draft"], default: "active" },

    variants: [VariantSchema],   // ✅ all variations here
    gender: { type: String, enum: ["men", "women", 'boys', 'girls', "unisex", "all"] },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Auto slug & SKU for variants
ProductSaleSchema.pre("save", function (next) {
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

softDelete(ProductSaleSchema);
module.exports = mongoose.model('ProductSale', ProductSaleSchema);
