// services/payment.service.js
const Razorpay = require('razorpay');
// const Stripe = require('stripe');
const crypto = require('crypto');
const ENVIRONMENT = require('../config/env');

const razorpay = new Razorpay({
    key_id: ENVIRONMENT.RAZORPAY_KEY_ID,
    key_secret: ENVIRONMENT.RAZORPAY_KEY_SECRET
});

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

/**
 * Create Razorpay order (server-side)
 * amount: in rupees (Number) -> razorpay needs paise
 */
async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const rpOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100), // paise
        currency,
        receipt: String(receipt),
        notes,
        payment_capture: 1 // auto-capture
    });
    return rpOrder; // contains id, amount, receipt, etc
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
