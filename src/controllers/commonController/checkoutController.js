// controllers/commonController/checkoutController.js  (add this function and use it)
const ENVIRONMENT = require("../../config/env");
const paymentService = require("../../services/payment.service")

async function createPaymentForOrder({ order, user, gateway = 'razorpay' }) {
    try {
        const amount = Number(order.total) || (Number(order.rentAmount || 0) + Number(order.depositAmount || 0));
        const currency = order.currency || 'INR';

        if (gateway === 'razorpay') {
            const rpOrder = await paymentService.createRazorpayOrder({
                amount,
                currency,
                receipt: String(order._id),
                notes: {
                    orderId: String(order._id),
                    userId: String(user?._id || user?.id || order.user || '')
                }
            });

            // Store mapping safely on order
            try {
                order.paymentGateway = 'razorpay';
                order.paymentIntentId = rpOrder.id;
                order.paymentResponse = rpOrder;
                if (typeof order.save === 'function') {
                    await order.save();
                }
            } catch (saveErr) {
                console.warn("order.save failed, falling back to direct collection update:", saveErr.message);
                const Model = order.constructor;
                if (Model && typeof Model.findByIdAndUpdate === 'function') {
                    await Model.findByIdAndUpdate(order._id, {
                        paymentGateway: 'razorpay',
                        paymentIntentId: rpOrder.id,
                        paymentResponse: rpOrder
                    });
                }
            }

            return {
                gateway: 'razorpay',
                razorpayOrder: rpOrder,
                keyId: (ENVIRONMENT.RAZORPAY_KEY_ID || 'rzp_live_RJ78sILs64v88G').trim()
            };
        } else if (gateway === 'stripe') {
            const pi = await paymentService.createStripePaymentIntent({
                amount,
                currency,
                metadata: { orderId: String(order._id), userId: String(user?._id || user?.id || '') },
                receipt_email: user?.email || undefined
            });

            try {
                order.paymentGateway = 'stripe';
                order.paymentIntentId = pi.id;
                order.paymentResponse = pi;
                if (typeof order.save === 'function') {
                    await order.save();
                }
            } catch (saveErr) {
                const Model = order.constructor;
                if (Model && typeof Model.findByIdAndUpdate === 'function') {
                    await Model.findByIdAndUpdate(order._id, {
                        paymentGateway: 'stripe',
                        paymentIntentId: pi.id,
                        paymentResponse: pi
                    });
                }
            }

            return {
                gateway: 'stripe',
                clientSecret: pi.client_secret,
                paymentIntentId: pi.id
            };
        } else {
            throw new Error(`Unsupported payment gateway: ${gateway}`);
        }
    } catch (error) {
        console.error("Error in createPaymentForOrder:", error.message || error);
        throw error;
    }
}

module.exports = { createPaymentForOrder };