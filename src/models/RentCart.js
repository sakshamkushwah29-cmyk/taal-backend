// models/RentCart.js
const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete');
const { Schema } = mongoose;

const RentCartItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'ProductRent', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    qty: { type: Number, required: true, min: 1 },

    // snapshot of rent price
    rentPricePerDay: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true } // (rentPricePerDay * qty * days) -> will be recalculated on checkout
}, { _id: false });

const RentCartSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [RentCartItemSchema],

    // totals
    grossSubtotal: { type: Number, default: 0 }, // qty * rentPricePerDay (without discount)
    discount: { type: Number, default: 0 },      // grossSubtotal - totalPayable(discounted)
    totalDeposit: { type: Number, default: 0 },
    totalPayable: { type: Number, default: 0 }, // after discount and deposit

    coupon: { type: String, default: null }
}, { timestamps: true });

RentCartSchema.index({ user: 1 });

softDeletePlugin(RentCartSchema);

module.exports = mongoose.model('RentCart', RentCartSchema);
