// models/TicketTemplate.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const TicketTemplateSchema = new Schema({
    name: { type: String, required: true },
    html: { type: String, required: true }, // placeholder HTML (use handlebars-like tokens)
    css: String,
    variables: [String], // allowed variables e.g. ['userName','eventDate','ticketId']
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

softDelete(TicketTemplateSchema);
module.exports = mongoose.model('TicketTemplate', TicketTemplateSchema);
