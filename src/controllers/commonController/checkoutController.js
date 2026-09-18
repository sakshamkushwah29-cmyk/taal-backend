// controllers/commonController/checkoutController.js  (add this function and use it)
const ENVIRONMENT = require("../../config/env");
const paymentService = require("../../services/payment.service")

async function createPaymentForOrder({ order, user, gateway = 'razorpay' }) {
    try {
        console.log(order, "order")
        const amount = order.total || (order.rentAmount + order.depositAmount); // final amount
        const currency = order.currency || 'INR';
        if (gateway === 'razorpay') {
            const rpOrder = await paymentService.createRazorpayOrder({
                amount,
                currency,
                receipt: String(order._id),
                notes: { orderId: String(order._id), userId: String(user._id) }
            });

            // store mapping on order
            order.paymentGateway = 'razorpay';
            order.paymentIntentId = rpOrder.id;
            order.paymentResponse = rpOrder;
            await order.save();

            // Return minimal data needed by client to open Razorpay checkout
            return {
                gateway: 'razorpay',
                razorpayOrder: rpOrder,
                keyId: ENVIRONMENT.RAZORPAY_KEY_ID
            };
        } else if (gateway === 'stripe') {
            const pi = await paymentService.createStripePaymentIntent({
                amount,
                currency,
                metadata: { orderId: String(order._id), userId: String(user._id) },
                receipt_email: user.email || undefined
            });

            order.paymentGateway = 'stripe';
            order.paymentIntentId = pi.id;
            order.paymentResponse = pi;
            await order.save();

            return {
                gateway: 'stripe',
                clientSecret: pi.client_secret,
                paymentIntentId: pi.id
            };
        } else {
            throw new Error('Unsupported gateway');
        }
    } catch (error) {
        return error;
    }
}

module.exports = { createPaymentForOrder };