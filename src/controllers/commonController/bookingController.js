const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const EventSession = require("../../models/EventSession");
const Event = require("../../models/Event");
const fs = require("fs");
const path = require("path");
const TicketBooking = require("../../models/TicketBooking");
const UserService = require("../../services/userServices");
const { successRes } = require("../../utils/responseFormatter");
const sendMail = require("../../utils/sendMail");
const QRCode = require("qrcode");
const moment = require("moment");
const { createCanvas, loadImage } = require("canvas");
const { GarbaGalaTemplate } = require("../../emailTemplates/ticketTemplate");
const nodeHtmlToImage = require("node-html-to-image");
const { thanksMailToUser } = require("../../emailTemplates/thanksMailTemplate");
const User = require("../../models/User");
const { formatTime24to12 } = require("../../utils/helper");
const QueryBuilder = require("../../services/queryBuilder");
const Razorpay = require("razorpay");
const ENVIRONMENT = require("../../config/env");
const crypto = require("crypto");
const mongoose = require("mongoose");



exports.getTicketReport = catchAsync(async (req, res, next) => {
    const { eventId, eventSessionId } = req.query;
  
    const match = {};
    if (eventId) match.event = new mongoose.Types.ObjectId(eventId);
    if (eventSessionId) match.eventSession = new mongoose.Types.ObjectId(eventSessionId);
  
    // 🟢 Ticket Aggregation
    const report = await TicketBooking.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalTickets: { $sum: "$quantity" },
  
          // Payment status
          paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] } },
          refunded: { $sum: { $cond: [{ $eq: ["$paymentStatus", "refunded"] }, 1, 0] } },
  
          // Ticket status
          confirmed: { $sum: { $cond: [{ $eq: ["$ticketStatus", "confirmed"] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ["$ticketStatus", "processing"] }, 1, 0] } },
          retrying: { $sum: { $cond: [{ $eq: ["$ticketStatus", "retrying"] }, 1, 0] } },
          failedTickets: { $sum: { $cond: [{ $eq: ["$ticketStatus", "failed"] }, 1, 0] } },
          pendingTickets: { $sum: { $cond: [{ $eq: ["$ticketStatus", "pending"] }, 1, 0] } },
        },
      },
    ]);
  
    let finalReport = report.length ? report[0] : {};
  
    // 🟢 Event Session Capacity Add
    if (eventSessionId) {
      const session = await EventSession.findById(eventSessionId).select("totalCapacity remainingCapacity");
      if (session) {
        finalReport.totalCapacity = session.totalCapacity;
        finalReport.remainingCapacity = session.remainingCapacity;
      }
    }
  
    return successRes(res,200,true, "Ticket report fetched successfully", finalReport);
  });