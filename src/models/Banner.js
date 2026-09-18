// models/Banner.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const BannerSchema = new Schema({
    title: String,
    imageUrl: String,
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

softDelete(BannerSchema);
module.exports = mongoose.model('Banner', BannerSchema);
