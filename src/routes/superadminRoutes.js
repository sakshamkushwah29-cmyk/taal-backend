const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController/userAuthController");
const authController = require("../controllers/commonController/authController");
const adminManagerController = require("../controllers/adminController/adminManagerController");
const adminGatekeeperController = require("../controllers/adminController/adminGatekeeperController");
const adminProductController = require("../controllers/adminController/adminProductController");
const saleProductValidation = require("../validations/saleProductValidation");
const adminCategoryController = require("../controllers/adminController/adminCategoryController");
const adminOrderManagementController = require("../controllers/adminController/adminOrderManagementController");
const adminRentProductController = require("../controllers/adminController/adminRentProductController");
const adminPolicyController = require("../controllers/adminController/adminPolicyController");
const bookingController = require("../controllers/commonController/bookingController");
const contactUsController = require("../controllers/adminController/contactUsController");
const ticketManagemenrController = require('../controllers/commonController/ticketManagementController')
const adminDisputeController = require('../controllers/adminController/adminDisputeController')
const adminDashboardController = require("../controllers/adminController/adminDashboardController");
const { protect } = require("../utils/jwt");
const { validateBody, validateQuery } = require("../middlewares/validate");
const categoryValidation = require("../validations/categoryValidation");
const productRentValidators = require("../validations/productRentValidators");
const { uploadProductImage } = require("../services/multer");
const { generateTicketFromAdminSideSchema } = require("../validations/eventValidation");

//roles : superadmin, event_manager, gatekeeper

router.post('/login-admin', authController.loginAdmin);
router.get('/get-admin-profile', protect('superadmin', 'event_manager', 'gatekeeper'), authController.getUserProfile);
router.put('/update-admin-profile', protect('superadmin', 'event_manager', 'gatekeeper'), authController.updateUserProfile);
router.put('/change-password', protect('superadmin', 'event_manager', 'gatekeeper'), authController.changePassword);
router.post('/forget-password', authController.forgetPassowrd);
router.put('/reset-password', authController.resetPassword);

/**  Event-Manager Management Routes */

router.post('/create-event-manager', protect('superadmin'), adminManagerController.createEventManager);
router.get('/get-all-event-managers', protect('superadmin'), adminManagerController.getAllEventManagers);
router.get('/get-event-manager', protect('superadmin'), adminManagerController.getEventManager);
router.put('/block-unblock-event-manager', protect('superadmin'), adminManagerController.blockUnblockManager);
router.put('/update-event-manager', protect('superadmin'), adminManagerController.updateManagerProfile);
router.put('/delete-event-manager', protect('superadmin'), adminManagerController.deleteEventManager);
router.get('/search-event-manager', protect('superadmin'), adminManagerController.searchEventManager);

/* Gatekeeper Management Routes */
router.post('/create-gatekeeper', protect('superadmin', 'event_manager'), adminGatekeeperController.createGatekeeper);
router.get('/get-all-gatekeepers', protect('superadmin', 'event_manager'), adminGatekeeperController.getAllGatekeepers);
router.get('/get-gatekeeper', protect('superadmin', 'event_manager'), adminGatekeeperController.getGatekeeper);
router.put('/block-unblock-gatekeeper', protect('superadmin'), adminGatekeeperController.blockUnblockGatekeeper);
router.put('/update-gatekeeper', protect('superadmin', 'event_manager'), adminGatekeeperController.updateGatekeeperProfile);
router.put('/delete-gatekeeper', protect('superadmin'), adminGatekeeperController.deleteGatekeeper);
router.get('/search-gatekeeper', protect('superadmin', 'event_manager'), adminGatekeeperController.searchGateKeeper);

/** Category Management */
router.post('/create-category', protect('superadmin'), validateBody(categoryValidation.createCategoryValidation), adminCategoryController.createCategory);
router.get('/get-categories', protect('superadmin'), adminCategoryController.getCategories);
router.get('/get-category', protect('superadmin'), validateQuery(categoryValidation.getCategoryValidation), adminCategoryController.getCategory);
router.put('/update-category', protect('superadmin'), validateBody(categoryValidation.updateCategoryValidation), adminCategoryController.updateCategory);
router.put('/delete-category', protect('superadmin'), validateBody(categoryValidation.deleteCategoryValidation), adminCategoryController.deleteCategory);

/** Sale Product Management */
router.post('/upload-product-images', protect('superadmin'), uploadProductImage, adminProductController.uploadProductImage);
router.post('/create-product', protect('superadmin'), validateBody(saleProductValidation.createProductSchema), adminProductController.createSaleProduct);
router.get('/get-all-sale-products', protect('superadmin'), adminProductController.getAllSalesProducts);
router.get('/get-sales-product-by-id', protect('superadmin'), validateQuery(saleProductValidation.getProductByIdValidation), adminProductController.getSaleProductById);
router.put('/update-sale-product', protect('superadmin'), validateBody(saleProductValidation.updateProductValidation), adminProductController.updateSaleProduct);
router.put("/change-product-status", protect('superadmin'), validateBody(saleProductValidation.changeProductStatusValidation), adminProductController.activeDeactiveSaleProduct);

/** Rent Product Management */
router.post('/create-rent-product', protect('superadmin'), validateBody(productRentValidators.createProductSchema), adminRentProductController.createRentProduct);
router.get('/get-all-rent-products', protect('superadmin'), adminRentProductController.getRentProducts);
router.get('/get-rent-product-by-id', protect('superadmin'), adminRentProductController.getRentProduct);
router.put('/update-rent-product', protect('superadmin'), validateBody(productRentValidators.updateProductSchema), adminRentProductController.updateRentProduct);
router.put('/delete-rent-product', protect('superadmin'), adminRentProductController.deleteRentProduct);
router.put("/change-rent-product-status", protect('superadmin'), validateBody(productRentValidators.changeProductStatusValidation), adminRentProductController.activeDeactiveProduct);

/** ====================== Order Management================= */
router.get('/get-order-list', protect('superadmin'), adminOrderManagementController.adminListOrders);
router.get('/order-details', protect('superadmin'), adminOrderManagementController.adminGetOrderById);
router.put('/update-order-status', protect('superadmin'), adminOrderManagementController.updateOrderStatus);



/** ====================== Policy Management================= */

router.post("/create-or-update-policy", protect("superadmin"), adminPolicyController.createOrUpdatePolicy);
router.get("/get-policy", protect("superadmin"), adminPolicyController.getPolicy);
router.get("/get-all-policy", protect("superadmin"), adminPolicyController.getAllPolicies);


/** ====================== Common Management=================*/

router.get('/ticket-reports', protect('superadmin'), bookingController.getTicketReport)

/**========================Contact Us==================== */
router.get("/get-all-contacts", protect("superadmin"), contactUsController.getAllContactUs);

/**======================== Ticket Booking ============== */
router.post('/genrate-ticket-admin', protect('superadmin'), validateBody(generateTicketFromAdminSideSchema), ticketManagemenrController.generateTicketFromAdminSide)
router.get('/get-generated-tickets', protect('superadmin'), ticketManagemenrController.getAllGeneratedByTicketId)


/**=================== Dispute Management ================= */

router.get('/search-booking', protect('superadmin'), adminDisputeController.searchBookings);
router.get('/check-payment-status', protect('superadmin'), adminDisputeController.checkPaymentStatus);
router.put('/update-payment-status', protect('superadmin'), adminDisputeController.updatePaymentStatus);

/**===================Payment Management=================== */
router.get('/get-all-payments', protect('superadmin'), adminDisputeController.getOverallPayments);

/**===================Ticket Bookings Dashboard=================== */
router.get('/overall-tickets-from-users', protect('superadmin', 'event_manager'), adminDashboardController.getOverallTicketsFromUsers);

/**===================Order Insights Dashboard=================== */
router.get('/order-insights', protect('superadmin'), adminDashboardController.getOrderInsights);

module.exports = router;
