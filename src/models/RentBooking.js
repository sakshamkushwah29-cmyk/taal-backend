// models/RentBooking.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const RentItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'ProductRent', required: true },
    variantId: { type: Schema.Types.ObjectId }, // selected variant id
    size: String,
    qty: { type: Number, required: true, min: 1 },
    pricePerDaySnapshot: { type: Number, required: true }, // snapshot of price used for booking
    productSnapshot: { // product & variant snapshot at booking time
        _id: Schema.Types.ObjectId,
        title: String,
        sku: String,
        deposit: Number,
        rentPricePerDay: Number,
        currency: String,
        variantSnapshot: {
            _id: Schema.Types.ObjectId,
            color: String,
            size: String,
            sku: String
        },
        images: { type: [String], default: [] }
    }
}, { _id: false });

// snapshot shape for addresses (keeps history)
const AddressSnapshotSchema = new Schema({
    fullName: String,
    phone: String,
    labeL: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
}, { _id: false });

const RentBookingSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    items: { type: [RentItemSchema], required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },

    rentAmount: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['online', 'cod'], default: 'online' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },

    pickupAddress: { type: Schema.Types.ObjectId, ref: 'Address' },
    pickupAddressSnapshot: AddressSnapshotSchema,

    returnAddress: { type: Schema.Types.ObjectId, ref: 'Address' },
    returnAddressSnapshot: AddressSnapshotSchema,

    deliveryMethod: { type: String, enum: ['localPickup', 'courier'], default: 'localPickup' },

    orderStatus: { type: String, enum: ['pending', 'booked', 'dispatched', 'in_use', 'returned', 'completed', 'cancelled'], default: 'pending' },

    paymentGateway: { type: String, enum: ['razorpay', 'stripe', null], default: null }, // which gateway was used
    paymentIntentId: { type: String, default: null },   // gateway-specific id (razorpay_order_id / stripe_payment_intent_id)
    paymentResponse: { type: Object, default: null },   // store raw gateway response (capture data)
    idempotencyKey: { type: String, default: null },
}, { timestamps: true });

// indexes for faster queries
RentBookingSchema.index({ user: 1, status: 1, paymentStatus: 1, createdAt: -1 });

softDelete(RentBookingSchema);
module.exports = mongoose.model('RentBooking', RentBookingSchema);
