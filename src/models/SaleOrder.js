// models/SaleOrder.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const OrderItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'ProductSale', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true }, // specific variant of that product

    // Snapshot (so old order doesn't break if product changes later)
    titleSnapshot: { type: String, required: true },
    colorSnapshot: { type: String },
    sizeSnapshot: { type: String },
    skuSnapshot: { type: String },

    qty: { type: Number, required: true },
    priceSnapshot: { type: Number, required: true },       // original price at time of order
    discountPriceSnapshot: { type: Number },               // discount price at time of order
    total: { type: Number, required: true }
}, { _id: false });


const ShipmentSchema = new Schema({
    courier: { type: String, default: 'Bluedart' },
    awb: String,
    trackingUrl: String,
    status: String
}, { _id: false });

// models/SaleOrder.js  (modified parts)
const SaleOrderSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [OrderItemSchema],
    subtotal: Number,
    shippingCharges: Number,
    total: Number,
    address: { type: Schema.Types.ObjectId, ref: 'Address', required: true },
    paymentMethod: { type: String, enum: ['online', 'cod'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },

    // ---------- NEW fields ----------
    paymentGateway: { type: String, enum: ['razorpay', 'stripe', null], default: null }, // which gateway was used
    paymentIntentId: { type: String, default: null },   // gateway-specific id (razorpay_order_id / stripe_payment_intent_id)
    paymentResponse: { type: Object, default: null },   // store raw gateway response (capture data)
    idempotencyKey: { type: String, default: null },    // store idempotency key for avoidance of duplicates
    currency: { type: String, default: 'INR' },
    // ---------------------------------

    shipment: ShipmentSchema,
    orderStatus: { type: String, enum: ['placed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'], default: 'placed' },
    notes: String,
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: ['user', 'admin', 'delivery'], default: 'user' },

    // --------- NEW TIMESTAMPS ----------
    placedAt: { type: Date, default: Date.now }, // order create time
    packedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
}, { timestamps: true });

softDelete(SaleOrderSchema);
module.exports = mongoose.model('SaleOrder', SaleOrderSchema);
