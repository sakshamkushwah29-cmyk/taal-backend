const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const TicketSubSchema = new Schema({
    ticketId: { type: String, required: true },
    qrData: { type: String },
    qrImage: String,
    pdfPath: String,
    attendeeName: String,
    isVipTicket: { type: Boolean, default: false },
    validForAllDays: { type: Boolean, default: false },

    // ✅ New (scan history per day)
    scanHistory: [{
        scannedAt: { type: Date, default: Date.now },
        gate: { type: String } // optional → agar multiple gates hai
    }],

    status: { type: String, enum: ['pending', 'generated', 'failed'], default: 'pending' },
    error: String
}, { _id: false, timestamps: true });


const TicketBookingSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventSession: { type: Schema.Types.ObjectId, ref: 'EventSession', required: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    quantity: { type: Number, required: true },
    attendeeDetails: [{ name: String, phone: String }],
    pricePerTicket: Number,
    totalAmount: Number,
    platformFee: Number,
    currency: { type: String, default: 'INR' },

    paymentMethod: { type: String, enum: ['razorpay'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentProcessedUsing: { type: String, enum: ['verify-api', 'webhook', 'admin-manual'] },

    ticketStatus: { type: String, enum: ['pending', 'processing', 'retrying', 'confirmed', 'failed'], default: 'pending' },

    retryCount: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    processingAt: { type: Date },

    paymentInitiatedAt: { type: Date, default: Date.now },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    tickets: [TicketSubSchema],
    bookedAt: { type: Date, default: Date.now },
    notes: String,
    generatedBy: { type: String, enum: ['user', 'admin', 'event_manager'], default: 'user' },
    isVipTicket: { type: Boolean, default: false },
    validForAllDays: { type: Boolean, default: false },
}, { timestamps: true });

TicketBookingSchema.index({ user: 1, eventSession: 1 });
TicketBookingSchema.index({ ticketStatus: 1, paymentStatus: 1, updatedAt: 1 });

TicketBookingSchema.index(
    {
        event: 1,
        ticketStatus: 1,
        "tickets.isVipTicket": 1,
        "tickets.validForAllDays": 1,
        "tickets.createdAt": -1
    }
);

softDelete(TicketBookingSchema);


module.exports = mongoose.model('TicketBooking', TicketBookingSchema);
