// models/Payment.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const PaymentSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    refType: { type: String }, // 'ticketBooking', 'saleOrder', 'rentBooking'
    refId: { type: Schema.Types.ObjectId },
    amount: Number,
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: ['razorpay', 'cod', 'other'] },
    status: { type: String, enum: ['pending', 'successful', 'failed', 'refunded'], default: 'pending' },
    meta: Schema.Types.Mixed, // store razorpayOrderId/paymentId/signature etc
}, { timestamps: true });

softDelete(PaymentSchema);
module.exports = mongoose.model('Payment', PaymentSchema);
