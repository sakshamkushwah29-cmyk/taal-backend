// const cron = require("node-cron");
// const TicketBooking = require("../models/TicketBooking");
// const { generateTicketsForBooking } = require("../services/ticket.service");
// const sendMail = require("../utils/sendMail");
// const ENVIRONMENT = require("../config/env");

// const MAX_RETRIES = 3;
// const ADMIN_EMAIL = ENVIRONMENT.ADMIN_EMAIL || "superadmin@yopmail.com";

// cron.schedule("*/1 * * * *", async () => {
//     console.log("🎯 Ticket Worker running...");

//     const pendingBookings = await TicketBooking.find({
//         ticketStatus: { $in: ["pending", "processing", "retrying"] },
//         paymentStatus: "paid"
//     }).limit(5);

//     console.log(pendingBookings, "pending bookings")
//     if (pendingBookings.length > 0) {
//         for (const booking of pendingBookings) {
//             try {
//                 if (!booking.retryCount) booking.retryCount = 0;

//                 booking.ticketStatus = "processing";
//                 await booking.save();
//                 await generateTicketsForBooking(booking._id);

//                 console.log(`✅ Tickets generated for booking ${booking._id}`);
//             } catch (err) {
//                 console.error(`❌ Ticket generation failed for ${booking._id}:`, err.message);

//                 booking.retryCount = (booking.retryCount || 0) + 1;

//                 if (booking.retryCount < MAX_RETRIES) {
//                     booking.ticketStatus = "retrying";
//                     booking.lastError = err.message;
//                     await booking.save();
//                     console.log(`🔁 Retrying booking ${booking._id} (attempt ${booking.retryCount})`);
//                 } else {
//                     booking.ticketStatus = "failed";
//                     booking.lastError = err.message;
//                     await booking.save();

//                     // 🚨 Alert admin
//                     await sendMail({
//                         to: ADMIN_EMAIL,
//                         subject: `⚠️ Ticket Generation Failed (Booking ${booking._id})`,
//                         text: `
// Booking failed after ${MAX_RETRIES} retries.

// Booking ID: ${booking._id}
// User: ${booking.user}
// Event: ${booking.event}
// Session: ${booking.eventSession}
// Error: ${err.message}

// Please check logs for details.`,
//                     });
//                     console.log(`🚨 Admin notified about booking ${booking._id} failure`);
//                 }
//             }
//         }
//     } else {
//         console.log("No pending bookings found.");
//     }

// });

// workers/ticketWorker.js

const cron = require("node-cron");
const mongoose = require("mongoose");
const TicketBooking = require("../models/TicketBooking");
const { generateTicketsForBooking } = require("../services/ticket.service");
const sendMail = require("../utils/sendMail");
const ENVIRONMENT = require("../config/env");

const MAX_RETRIES = 3;
const ADMIN_EMAIL = ENVIRONMENT.ADMIN_EMAIL || "superadmin@yopmail.com";

const PROCESSING_STALE_MINUTES = 15;

cron.schedule("*/20 * * * * *", async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  console.log("🎯 Ticket Worker running...");

  try {
    let processed = 0;

    while (processed < 5) {
      // Claim a single job atomically
      const now = new Date();
      const staleCutoff = new Date(
        now.getTime() - PROCESSING_STALE_MINUTES * 60 * 1000
      );

      const booking = await TicketBooking.findOneAndUpdate(
        {
          paymentStatus: "paid",
          $or: [
            { ticketStatus: { $in: ["pending", "retrying", "failed"] } },
            { ticketStatus: "processing", processingAt: { $lte: staleCutoff } }, // recover stuck
          ],
        },
        { $set: { ticketStatus: "processing", processingAt: now } },
        { new: true, sort: { updatedAt: 1 } }
      );

      if (!booking) break; // no more work

      try {
        const result = await generateTicketsForBooking(booking._id);

        console.log(
          `✅ Tickets generated for booking ${booking._id} (attempt ${booking.retryCount || 0
          })`
        );

        if (!result.success) {
          // Partial/failed → retry or fail hard
          const nextRetry = (booking.retryCount || 0) + 1;
          const willRetry = nextRetry < MAX_RETRIES;

          await TicketBooking.updateOne(
            { _id: booking._id },
            {
              $set: {
                ticketStatus: willRetry ? "retrying" : "failed",
                lastError:
                  result.errors?.map((e) => e.error).join("; ") ||
                  "Ticket generation failed",
                processingAt: null,
              },
              ...(willRetry
                ? { $inc: { retryCount: 1 } }
                : { $setOnInsert: {} }),
            }
          );

          if (!willRetry) {
            try {
              await sendMail({
                to: ADMIN_EMAIL,
                subject: `⚠️ Ticket Generation Failed (Booking ${booking._id})`,
                text: `Booking failed after ${MAX_RETRIES} retries.

                Booking ID: ${booking._id}
                User: ${booking.user}
                Event: ${booking.event}
                Session: ${booking.eventSession}
                Error(s): ${(result.errors || [])
                    .map((e) => `${e.ticketId}: ${e.error}`)
                    .join(", ") || "Unknown"
                  }
                `,
              });
              console.log(`🚨 Admin notified about booking ${booking._id} failure`);
            } catch (mailErr) {
              console.error(
                `❌ Failed to notify admin for ${booking._id}:`,
                mailErr.message);
            }
          }
        }
        else {
          // Success → clear error fields
          await TicketBooking.updateOne(
            { _id: booking._id },
            {
              $set: {
                lastError: null,
                processingAt: null,
                retryCount: booking.retryCount || 0,
              },
            }
          );
          console.log(`✅ Tickets generated for booking ${booking._id}`);
        }
      } catch (err) {
        // Hard exception (fs, mail, etc.) → retry/fail
        const nextRetry = (booking.retryCount || 0) + 1;
        const willRetry = nextRetry < MAX_RETRIES;

        await TicketBooking.updateOne(
          { _id: booking._id },
          {
            $set: {
              ticketStatus: willRetry ? "retrying" : "failed",
              lastError: err.message || String(err),
              processingAt: null,
            },
            ...(willRetry ? { $inc: { retryCount: 1 } } : { $setOnInsert: {} }),
          }
        );

        if (!willRetry) {
          try {
            await sendMail({
              to: ADMIN_EMAIL,
              subject: `⚠️ Ticket Generation Failed (Booking ${booking._id})`,
              text: `Booking failed after ${MAX_RETRIES} retries.

Booking ID: ${booking._id}
User: ${booking.user}
Event: ${booking.event}
Session: ${booking.eventSession}
Error: ${err.message}

Please check logs for details.`,
            });
            console.log(
              `🚨 Admin notified about booking ${booking._id} failure`
            );
          } catch (mailErr) {
            console.error(
              `❌ Failed to notify admin for ${booking._id}:`,
              mailErr.message
            );
          }
        } else {
          console.log(
            `🔁 Retrying booking ${booking._id} (attempt ${nextRetry})`
          );
        }
      }

      processed++;
    }

    if (processed === 0) console.log("No pending bookings found.");
  } catch (outerErr) {
    console.error("🚨 Worker loop crashed:", outerErr);
  }
});
