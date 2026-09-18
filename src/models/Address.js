// models/Address.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const AddressSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // optional: may store generic addresses
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    label: { type: String }, // home, office
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
    lat: Number,
    lng: Number,
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

softDelete(AddressSchema);
module.exports = mongoose.model('Address', AddressSchema);
