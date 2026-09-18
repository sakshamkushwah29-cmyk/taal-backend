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



router.post('/create-user', authController.createUser);
router.post('/upload-avatar', uploadUserProfile, authController.uploadAvatar);
router.put('/verify-email-with-link', authController.verifyEmailWithLink);
router.post('/resend-verification-email', authController.resendVerificationEmail);
router.post('/login-user', authController.loginUser);
router.get('/get-user-profile', protect('user'), authController.getUserProfile);
router.put('/update-user-profile', protect('user'), authController.updateUserProfile);
router.put('/change-password', protect('user'), authController.changePassword);
router.post('/forget-password', authController.forgetPassowrd);
router.put('/reset-password', authController.resetPassword);
router.post('/create-address', protect('user'), userAuthController.createAddress);

/** ==================== Address Routes ==================== */
router.post('/add-address', protect('user'), userAuthController.createAddress);
router.get('/get-all-address', protect('user'), userAuthController.getAllAddresses);
router.get('/get-address-by-id', protect('user'), userAuthController.getAddressById);
router.put('/update-address', protect('user'), userAuthController.updateAddress);
router.put('/delete-address', protect('user'), userAuthController.deleteAddress);

/** event Details Routes */
router.get('/get-all-events', eventManagementController.getAllEvents);
router.get('/get-event', eventManagementController.getEvent);
router.get('/get-event-session', eventManagementController.getEventSessionBySessionId);

/** Ticket Booking Routes */
router.post('/book-tickets', protect('user'), TicketBookingController.bookTickets);
router.post('/verify-ticket-payment', protect('user'), TicketBookingController.verifyTicketPayment);
router.get('/get-all-ticket-bookings', protect('user'), TicketBookingController.getTicketBookings);
router.get('/get-booking-by-id', protect('user'), TicketBookingController.getBookingById);


/** Cart Management */

router.post('/add-to-cart', protect('user'), cartController.addToCart);
router.get('/get-cart', protect('user'), cartController.getCart);
router.put('/remove-item-from-cart', protect('user'), cartController.removeItemFromCart);
router.put('/clear-cart', protect('user'), cartController.clearCart);
router.put('/update-item-quantity', protect('user'), cartController.updateItemQuantity);

/** Buy Product Routes */

router.get('/get-products', buyProductController.saleProductList);
router.get('/get-product-details', buyProductController.getSaleProductById);
// router.post('/buy-product', protect('user'), buyProductController.buyProduct);


router.post('/buy-now', protect('user'), buyProductController.buyNow);
router.post('/buy-from-cart', protect('user'), buyProductController.placeOrderFromCart);
router.get('/preview-checkout', protect('user'), buyProductController.previewCheckout);
router.post('/verify-razorpay-payment', protect('user'), paymentController.verifyRazorpayPayment);
router.get('/my-orders', protect('user'), buyProductController.getMyOrders);
router.get('/order-details', protect('user'), buyProductController.getMyOrderById);



/** =================== Rent Product Routes ================ */
router.get('/get-rent-products', rentBookingController.rentProductList);
router.get('/get-rent-product-details', rentBookingController.getRentProductById);
router.post('/rent-now', protect('user'), validateBody(bookingValidation.rentNowValidation), rentBookingController.rentNow);
router.post('/verify-rent-payment', protect('user'), rentBookingController.verifyRentPayment);

/**=================== Rent Product Cart Routes ================ */
router.post('/add-to-rent-cart', protect('user'), validateBody(bookingValidation.addRentalCartValidation), rentCartController.addItemToRentCart);
router.get('/get-rent-cart', protect('user'), rentCartController.getRentCart);



/** ==================Policy Management================= */

router.get("/get-policy", policyController.getPolicy);



/**====================== Contact Us =========================== */
router.post('/contact-us', contactUsController.createContactUs);

module.exports = router;
