// models/Shipment.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const ShipmentSchema = new Schema({
    saleOrder: { type: Schema.Types.ObjectId, ref: 'SaleOrder', required: true },
    courier: { type: String, default: 'Bluedart' },
    awb: String,
    status: String,
    lastUpdate: Date,
    meta: Schema.Types.Mixed
}, { timestamps: true });

softDelete(ShipmentSchema);
module.exports = mongoose.model('Shipment', ShipmentSchema);
