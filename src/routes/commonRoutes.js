const express = require("express");
const router = express.Router();
const eventManagementController = require("../controllers/commonController/eventManagementController");
const ticketManagementController = require("../controllers/commonController/ticketManagementController");
const { protect } = require("../utils/jwt");
const { validateBody } = require("../middlewares/validate");
const eventValidation = require("../validations/eventValidation");
const { uploadBannerImage, uploadEventImages } = require("../services/multer");

router.post('/upload-banner-image', protect('superadmin', 'event_manager'), uploadBannerImage, eventManagementController.uploadBannerImage);
router.post('/upload-event-images', protect('superadmin', 'event_manager'), uploadEventImages, eventManagementController.uploadEventImages);
router.post('/create-event', protect('superadmin', 'event_manager'), validateBody(eventValidation.createEvent), eventManagementController.createEvent);
router.get('/get-all-events', protect('superadmin', 'event_manager'), eventManagementController.getAllEvents);
router.get('/get-event', protect('superadmin', 'event_manager'), eventManagementController.getEvent);
router.put('/change-event-status', protect('superadmin', 'event_manager'), eventManagementController.changeEventStatus);
router.put('/update-event', protect('superadmin', 'event_manager'), validateBody(eventValidation.updateEvent), eventManagementController.updateEvent);
router.put('/delete-event', protect('superadmin', 'event_manager'), eventManagementController.deleteEvent);
/** Event Session Management */

router.post('/create-event-session', protect('superadmin', 'event_manager'), validateBody(eventValidation.createEventSession), eventManagementController.createEventSession);
router.get('/get-session-by-id', protect('superadmin', 'event_manager'), eventManagementController.getEventSessionBySessionId);
router.put('/delete-event-session', protect('superadmin', 'event_manager'), eventManagementController.deleteEventSession);
router.put('/change-event-session-status', protect('superadmin', 'event_manager'), eventManagementController.changeEventSessionStatus);
router.put('/update-event-session', protect('superadmin', 'event_manager'), validateBody(eventValidation.updateEventSession), eventManagementController.updateEventSession);
router.put('/update-event-session-status', protect('superadmin', 'event_manager'), eventManagementController.updateEventSessionStatus);

/** Scanned History */
//
router.get('/get-gatekeeper-scanned-history', protect('superadmin', 'event_manager'), eventManagementController.getGatekeeperScannedHistory);

/**===================== Ticket Management==================== */

router.get('/get-tickets-by-session-id', protect('superadmin', 'event_manager'), ticketManagementController.getTicketsBySessionId);
router.get('/get-ticket-by-id', protect('superadmin', 'event_manager'), ticketManagementController.getTicketById);
// router.put('/change-ticket-status', protect('superadmin', 'event_manager'), eventManagementController.changeTicketStatus);



module.exports = router;
