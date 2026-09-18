// models/GatekeeperScan.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const GatekeeperScanSchema = new Schema({
    gatekeeper: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // role must be gatekeeper
    ticketId: { type: String, required: true }, // plain ticketId or qrData reference
    ticketRef: { type: Schema.Types.ObjectId, ref: 'Ticket' },
    eventSession: { type: Schema.Types.ObjectId, ref: 'EventSession' },
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    scannedAt: { type: Date, default: Date.now },
    result: { type: String, enum: ['valid', 'invalid', 'already_scanned', 'expired', 'not_found'], required: true },
    notes: String
}, { timestamps: true });

GatekeeperScanSchema.index({ gatekeeper: 1, scannedAt: -1 });
softDelete(GatekeeperScanSchema);
module.exports = mongoose.model('GatekeeperScan', GatekeeperScanSchema);
