// models/SaleCart.js
const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');
const { Schema } = mongoose;

const CartItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'ProductSale', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    qty: { type: Number, required: true, min: 1 },

    // ✅ price fields
    mrp: { type: Number, required: true },
    sellPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true }
}, { _id: false });

const SaleCartSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [CartItemSchema],

    // ✅ new totals
    grossSubtotal: { type: Number, default: 0 }, // qty * MRP (without discount)
    discount: { type: Number, default: 0 },      // grossSubtotal - totalPayable
    totalPayable: { type: Number, default: 0 },  // after discount
    coupon: { type: String, default: null }
}, { timestamps: true });


SaleCartSchema.index({ user: 1 });

softDeletePlugin(SaleCartSchema);

module.exports = mongoose.model('SaleCart', SaleCartSchema);
