// services/payment.service.js
const Razorpay = require('razorpay');
// const Stripe = require('stripe');
const crypto = require('crypto');
const ENVIRONMENT = require('../config/env');

let _razorpay;
const razorpay = new Proxy({}, {
    get(target, prop) {
        if (!_razorpay) {
            const key_id = String(ENVIRONMENT.RAZORPAY_KEY_ID || 'rzp_live_RJ78sILs64v88G').trim();
            const key_secret = String(ENVIRONMENT.RAZORPAY_KEY_SECRET || 'lKEjpXVwhpe1FGEHQ2SD15ys').trim();
            _razorpay = new Razorpay({ key_id, key_secret });
        }
        return _razorpay[prop];
    }
});

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

/**
 * Create Razorpay order (server-side)
 * amount: in rupees (Number) -> razorpay needs paise
 */
async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    try {
        const amountInPaise = Math.round(Number(amount) * 100);
        console.log("createRazorpayOrder initializing:", { amountInPaise, currency, receipt });

        const rpOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: currency || 'INR',
            receipt: String(receipt || Date.now()).slice(0, 40),
            notes: typeof notes === 'object' && notes !== null ? notes : {},
            payment_capture: 1
        });

        console.log("createRazorpayOrder success:", rpOrder.id);
        return rpOrder;
    } catch (err) {
        console.error("createRazorpayOrder error:", err.message || err);
        throw err;
    }
}

/**
 * Verify Razorpay webhook signature.
 * rawBody should be raw request body string (not parsed object)
 */
function verifyRazorpaySignature(rawBody, signature) {
    const expected = crypto.createHmac('sha256', ENVIRONMENT.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    return expected === signature;
}

/**
 * Create Stripe PaymentIntent
 * amount in rupees -> stripe needs smallest currency unit
 */
async function createStripePaymentIntent({ amount, currency = 'INR', metadata = {}, receipt_email = null }) {
    const pi = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        metadata,
        receipt_email,
        // optionally: automatic_payment_methods: { enabled: true }
    });
    return pi;
}

/**
 * Verify Stripe webhook using constructEvent
 * rawBody: Buffer, sigHeader: value of stripe-signature header
 */
function constructStripeEvent(rawBody, sigHeader) {
    try {
        const event = stripe.webhooks.constructEvent(rawBody, sigHeader, process.env.STRIPE_WEBHOOK_SECRET);
        return event;
    } catch (err) {
        throw err;
    }
}

/**
 * Refund helpers (Razorpay & Stripe)
 */
async function refundRazorpayPayment(paymentId, amount = null) {
    // amount in rupees -> convert to paise if present
    const body = amount ? { amount: Math.round(amount * 100) } : {};
    return razorpay.payments.refund(paymentId, body);
}

async function refundStripePayment(paymentIntentId, amount = null) {
    const opts = amount ? { amount: Math.round(amount * 100) } : {};
    return stripe.refunds.create({ payment_intent: paymentIntentId, ...opts });
}

module.exports = {
    createRazorpayOrder,
    verifyRazorpaySignature,
    createStripePaymentIntent,
    constructStripeEvent,
    refundRazorpayPayment,
    refundStripePayment
};
