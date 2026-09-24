const express = require("express");
const router = express.Router();
const authController = require("../controllers/commonController/authController");
const userAuthController = require("../controllers/userController/userAuthController");
const TicketBookingController = require("../controllers/userController/ticketBookingController");
const eventManagementController = require("../controllers/commonController/eventManagementController");
const cartController = require("../controllers/userController/cartController");
const buyProductController = require("../controllers/userController/buyProductController");
const paymentController = require("../controllers/commonController/paymentController");
const rentBookingController = require("../controllers/userController/rentBookingController");
const rentCartController = require("../controllers/userController/rentCartController");
const policyController = require("../controllers/userController/policyController");
const contactUsController = require("../controllers/userController/contactUsController");
const { protect } = require("../utils/jwt");
const { uploadUserProfile } = require("../services/multer");
const bookingValidation = require("../validations/bookingValidation");
const { validateBody } = require("../middlewares/validate");
const contactUs = require("../models/contactUs");
const userRateLimiter = require("../middlewares/rateLimiter");


// router.use(userRateLimiter);



const protectUser = protect('user', 'event_manager', 'superadmin', 'gatekeeper');

router.post('/create-user', authController.createUser);
router.post('/upload-avatar', uploadUserProfile, authController.uploadAvatar);
router.put('/verify-email-with-link', authController.verifyEmailWithLink);
router.post('/resend-verification-email', authController.resendVerificationEmail);
router.post('/login-user', authController.loginUser);
router.get('/get-user-profile', protectUser, authController.getUserProfile);
router.put('/update-user-profile', protectUser, authController.updateUserProfile);
router.put('/change-password', protectUser, authController.changePassword);
router.post('/forget-password', authController.forgetPassowrd);
router.put('/reset-password', authController.resetPassword);
router.post('/create-address', protectUser, userAuthController.createAddress);

/** ==================== Address Routes ==================== */
router.post('/add-address', protectUser, userAuthController.createAddress);
router.get('/get-all-address', protectUser, userAuthController.getAllAddresses);
router.get('/get-address-by-id', protectUser, userAuthController.getAddressById);
router.put('/update-address', protectUser, userAuthController.updateAddress);
router.put('/delete-address', protectUser, userAuthController.deleteAddress);

/** event Details Routes */
router.get('/get-all-events', eventManagementController.getAllEvents);
router.get('/get-event', eventManagementController.getEvent);
router.get('/get-event-session', eventManagementController.getEventSessionBySessionId);

/** Ticket Booking Routes */
router.post('/book-tickets', protectUser, TicketBookingController.bookTickets);
router.post('/verify-ticket-payment', protectUser, TicketBookingController.verifyTicketPayment);
router.get('/get-all-ticket-bookings', protectUser, TicketBookingController.getTicketBookings);
router.get('/get-booking-by-id', protectUser, TicketBookingController.getBookingById);


/** Cart Management */

router.post('/add-to-cart', protectUser, cartController.addToCart);
router.get('/get-cart', protectUser, cartController.getCart);
router.put('/remove-item-from-cart', protectUser, cartController.removeItemFromCart);
router.put('/clear-cart', protectUser, cartController.clearCart);
router.put('/update-item-quantity', protectUser, cartController.updateItemQuantity);

/** Buy Product Routes */

router.get('/get-products', buyProductController.saleProductList);
router.get('/get-product-details', buyProductController.getSaleProductById);
// router.post('/buy-product', protectUser, buyProductController.buyProduct);


router.post('/buy-now', protectUser, buyProductController.buyNow);
router.post('/buy-from-cart', protectUser, buyProductController.placeOrderFromCart);
router.get('/preview-checkout', protectUser, buyProductController.previewCheckout);
router.post('/verify-razorpay-payment', protectUser, paymentController.verifyRazorpayPayment);
router.get('/my-orders', protectUser, buyProductController.getMyOrders);
router.get('/order-details', protectUser, buyProductController.getMyOrderById);



/** =================== Rent Product Routes ================ */
router.get('/get-rent-products', rentBookingController.rentProductList);
router.get('/get-rent-product-details', rentBookingController.getRentProductById);
router.post('/rent-now', protectUser, validateBody(bookingValidation.rentNowValidation), rentBookingController.rentNow);
router.post('/verify-rent-payment', protectUser, rentBookingController.verifyRentPayment);

/**=================== Rent Product Cart Routes ================ */
router.post('/add-to-rent-cart', protectUser, validateBody(bookingValidation.addRentalCartValidation), rentCartController.addItemToRentCart);
router.get('/get-rent-cart', protectUser, rentCartController.getRentCart);



/** ==================Policy Management================= */

router.get("/get-policy", policyController.getPolicy);



/**====================== Contact Us =========================== */
router.post('/contact-us', contactUsController.createContactUs);

module.exports = router;
