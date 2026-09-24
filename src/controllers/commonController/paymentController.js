// controllers/commonController/paymentController.js
const SaleOrder = require('../../models/SaleOrder');
const ProductSale = require('../../models/ProductSale');
const mongoose = require('mongoose');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const Razorpay = require('razorpay');
const { verifyRazorpaySignature } = require('../../services/payment.service');
const ENVIRONMENT = require('../../config/env');
const crypto = require('crypto');
const { successRes } = require('../../utils/responseFormatter');

/**
 * Helper: restock items (atomic increments)
 */
async function restockOrderItems(items) {
    // items: array of order items with { product, variantId, qty }
    for (const it of items) {
        await ProductSale.updateOne(
            { _id: it.product, 'variants._id': it.variantId },
            { $inc: { 'variants.$.stock': Number(it.qty) } }
        );
    }
}

const rpInstance = () => new Razorpay({
    key_id: String(ENVIRONMENT.RAZORPAY_KEY_ID || 'rzp_live_RJ78sILs64v88G').trim(),
    key_secret: String(ENVIRONMENT.RAZORPAY_KEY_SECRET || 'lKEjpXVwhpe1FGEHQ2SD15ys').trim()
});

/**
 * POST /api/v1/payment/verify
 * Body:
 *  {
 *    "razorpay_order_id": "order_xxx",
 *    "razorpay_payment_id": "pay_xxx",
 *    "razorpay_signature": "xxxxx",
 *    "orderId": "optional local order id (MongoId)"
 *  }
 *
 * Verifies signature, fetches payment from Razorpay, compares with local order,
 * sets paymentStatus = 'paid' (idempotent), saves paymentResponse.
 */

exports.verifyRazorpayPayment = catchAsync(async (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // 1) basic validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return next(new AppError('razorpay_order_id, razorpay_payment_id and razorpay_signature are required', 400));
    }
    const secret = String(ENVIRONMENT.RAZORPAY_KEY_SECRET || 'lKEjpXVwhpe1FGEHQ2SD15ys').trim();

    // 2) verify signature (HMAC SHA256 of order_id|payment_id)
    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generatedSignature !== String(razorpay_signature)) {
        return next(new AppError('Invalid signature - verification failed', 400));
    }

    // 3) find local order (try provided orderId first, then paymentIntentId mapping)
    let order = null;
    if (orderId && mongoose.isValidObjectId(orderId)) {
        order = await SaleOrder.findById(orderId);
    }
    if (!order) {
        order = await SaleOrder.findOne({ paymentIntentId: razorpay_order_id, _id: orderId });
    }

    if (!order) {
        // Not found locally — still possible (race / missing mapping). Return helpful message.
        return next(new AppError('Order not found for the provided payment/order id', 404));
    }

    // 4) idempotency: if already paid, return success
    if (order.paymentStatus === 'paid') {
        return res.json({ ok: true, message: 'Payment already verified', order });
    }

    // 5) optional sanity checks by fetching payment entity from Razorpay
    const rp = rpInstance();
    let paymentEntity = null;
    try {
        paymentEntity = await rp.payments.fetch(razorpay_payment_id);
    } catch (err) {
        // If fetch fails, we can still accept signature verification as valid, but it's safer to fail here.
        // Return a 502 so client can retry or use webhook as fallback.
        return next(new AppError('Unable to fetch payment details from Razorpay: ' + (err.message || err), 502));
    }

    // Ensure payment belongs to order
    if (String(paymentEntity.order_id) !== String(razorpay_order_id)) {
        return next(new AppError('Payment does not belong to the provided order (order id mismatch)', 400));
    }

    // Check payment status: prefer 'captured' (payment completed)
    // Some integrations may show 'authorized' depending on capture mode; treat 'captured' as success.
    const successStatuses = ['captured', 'authorized'];
    if (!successStatuses.includes(paymentEntity.status)) {
        return next(new AppError(`Payment status is '${paymentEntity.status}' — not a successful payment`, 400));
    }

    // 6) optional amount check (razorpay amounts in paise)
    const paidAmountPaise = Number(paymentEntity.amount || 0);
    const expectedPaise = Math.round(Number(order.total || 0) * 100); // order.total assumed in rupees

    let amountMismatch = false;
    if (paidAmountPaise !== expectedPaise) {
        amountMismatch = true;
        // don't automatically fail — record mismatch for manual reconciliation
        order.notes = (order.notes ? order.notes + ' | ' : '') +
            `PAYMENT_AMOUNT_MISMATCH(razorpay=${paidAmountPaise},expected=${expectedPaise})`;
    }

    // 7) update order idempotently
    order.paymentStatus = 'paid';
    order.paymentGateway = 'razorpay';
    order.paymentIntentId = razorpay_order_id;
    order.paymentResponse = {
        verifiedAt: new Date(),
        razorpay_payment_id,
        razorpay_order_id,
        raw: paymentEntity,
        amountMismatch
    };
    order.orderStatus = order.orderStatus === 'placed' ? 'placed' : 'placed'; // keep or set placed
    await order.save();
    return successRes(res, 200, true, 'Payment verified successfully', order);

});

/**
 * Razorpay unified webhook endpoint
 * - Use raw body and header 'x-razorpay-signature'
 * - Verify signature then process event types
 */
exports.razorpayWebhook = catchAsync(async (req, res, next) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || req.bodyRaw; // ensure you set raw body on request

    if (!verifyRazorpaySignature(rawBody, signature)) {
        return res.status(400).send('invalid signature');
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    // Example events: payment.captured, payment.failed, order.paid
    if (event === 'payment.captured' || event === 'order.paid') {
        // try to find order by receipt or by order id mapping
        const razorpayOrder = payload.payload.order && payload.payload.order.entity ? payload.payload.order.entity : null;
        const paymentEntity = payload.payload.payment && payload.payload.payment.entity ? payload.payload.payment.entity : null;

        const receipt = razorpayOrder ? razorpayOrder.receipt : (paymentEntity && paymentEntity.notes && paymentEntity.notes.receipt) || null;
        const razorpayOrderId = razorpayOrder ? razorpayOrder.id : (paymentEntity ? paymentEntity.order_id : null);

        // Find SaleOrder by paymentIntentId (we stored razorpayOrder.id) or receipt which is orderId
        let order = null;
        if (razorpayOrderId) {
            order = await SaleOrder.findOne({ paymentIntentId: razorpayOrderId });
        }
        if (!order && receipt) {
            // receipt is expected to be the saleOrder._id
            try { order = await SaleOrder.findById(String(receipt)); } catch (e) { /* ignore */ }
        }
        if (!order) {
            // cannot reconcile - log and return 200
            return res.status(200).json({ ok: true });
        }

        // Idempotency: if already paid -> noop
        if (order.paymentStatus === 'paid') {
            return res.status(200).json({ ok: true });
        }

        // mark paid
        order.paymentStatus = 'paid';
        order.paymentResponse = paymentEntity || payload;
        order.paymentMethod = 'online';
        await order.save();

        // trigger downstream (notifications, shipment) in your app
        return res.status(200).json({ ok: true });
    }

    if (event === 'payment.failed') {
        const paymentEntity = payload.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;
        const order = await SaleOrder.findOne({ paymentIntentId: razorpayOrderId });
        if (!order) return res.status(200).json({ ok: true });

        // if we decremented stock earlier, restock
        await restockOrderItems(order.items);

        order.paymentStatus = 'failed';
        order.paymentResponse = paymentEntity;
        await order.save();
        return res.status(200).json({ ok: true });
    }

    // unhandled events -> 200
    res.status(200).json({ ok: true });
});

/**
 * Stripe webhook handler (raw body)
 */
exports.stripeWebhook = catchAsync(async (req, res, next) => {
    const sig = req.headers['stripe-signature'];
    const rawBody = req.rawBody; // buffer
    let event;
    try {
        event = constructStripeEvent(rawBody, sig);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // handle payment_intent.succeeded / payment_intent.payment_failed
    if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        const orderId = pi.metadata && pi.metadata.orderId;
        if (!orderId) return res.status(200).json({ ok: true });

        const order = await SaleOrder.findById(orderId);
        if (!order) return res.status(200).json({ ok: true });

        if (order.paymentStatus === 'paid') return res.status(200).json({ ok: true });

        order.paymentStatus = 'paid';
        order.paymentResponse = pi;
        order.paymentIntentId = pi.id;
        await order.save();
        return res.status(200).json({ ok: true });
    }

    if (event.type === 'payment_intent.payment_failed') {
        const pi = event.data.object;
        const orderId = pi.metadata && pi.metadata.orderId;
        if (!orderId) return res.status(200).json({ ok: true });

        const order = await SaleOrder.findById(orderId);
        if (!order) return res.status(200).json({ ok: true });

        // restock if we had decremented already
        await restockOrderItems(order.items);

        order.paymentStatus = 'failed';
        order.paymentResponse = pi;
        await order.save();
        return res.status(200).json({ ok: true });
    }

    res.status(200).json({ received: true });
});
