/* ============================== Helpers ============================== */

const { default: mongoose } = require("mongoose");
const AppError = require("../utils/AppError");
const ProductSale = require("../models/ProductSale");
const ProductRent = require("../models/ProductRent");
const QueryBuilder = require("../services/queryBuilder");
const SaleOrder = require("../models/SaleOrder");
const RentBooking = require("../models/RentBooking");

const toInt = (v, d) => {
    const x = parseInt(v, 10);
    return Number.isFinite(x) && x > 0 ? x : d;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const effectivePriceOf = (variant) => {
    const p = Number(variant?.price || 0);
    const dp = Number(variant?.discountPrice || 0);
    return dp > 0 ? dp : p;
};

const discountPctOf = (variant) => {
    const p = Number(variant?.price || 0);
    const dp = Number(variant?.discountPrice || 0);
    if (p > 0 && dp > 0) return ((p - dp) / p) * 100;
    return 0;
};

// Shipping rule example (customize):
// - Free shipping if subtotal >= 999
// - Else flat 79
const calcShipping = (subtotal) => {
    if (subtotal >= 999) return 0;
    return 79;
};

// Optional coupon hook (replace with real Coupon model if you have)
async function applyCouponIfAny({ couponCode, userId, items, subtotal }) {
    // TODO: integrate your Coupon model & validations (expiry, user limit, min cart value, etc.)
    // For now, simple demo:
    if (!couponCode) return { coupon: null, discountAmount: 0, reason: null };

    const code = String(couponCode).toUpperCase();
    if (code === 'FLAT100' && subtotal >= 500) {
        return { coupon: code, discountAmount: 100, reason: null };
    }
    // invalid or not applicable
    return { coupon: null, discountAmount: 0, reason: 'Invalid or not applicable' };
}

// Load product + specific variant
async function loadProductAndVariant(productId, variantId, session = null) {
    let productQb = new QueryBuilder(ProductSale);
    const product = await productQb.findOne({ _id: productId }).session(session).exec();
    // const product = await ProductSale.findById(productId).session(session);
    if (!product) throw new AppError('Product not found', 404);

    const variant = product.variants.id(variantId);
    if (!variant) throw new AppError('Variant not found', 404);

    return { product, variant };
}

// Build order item snapshot
function buildOrderItemSnapshot({ product, variant, qty }) {
    const price = Number(variant.price || 0);
    const discountPrice = Number(variant.discountPrice || 0);
    const sell = effectivePriceOf(variant);

    return {
        product: product._id,
        variantId: variant._id,
        titleSnapshot: product.title,
        colorSnapshot: variant.color || null,
        sizeSnapshot: variant.size || null,
        skuSnapshot: variant.sku || null,
        qty: Number(qty),
        priceSnapshot: price,
        discountPriceSnapshot: discountPrice > 0 ? discountPrice : null,
        total: sell * Number(qty)
    };
}

// Atomic stock decrement for ONE line item
async function decrementStockAtomic({ productId, variantId, qty, session }) {
    const res = await ProductSale.updateOne(
        {
            _id: productId,
            isDeleted: false,
            'variants': {
                $elemMatch: {
                    _id: variantId,
                    stock: { $gte: qty }
                }
            }
        },
        {
            $inc: { 'variants.$[elem].stock': -qty }
        },
        {
            session,
            arrayFilters: [{ 'elem._id': variantId }]
        }
    );
    return res.matchedCount === 1 && res.modifiedCount === 1;
}

async function cancelAndRestockExpiredOrders() {
    const FIFTEEN_MINUTES_AGO = new Date(Date.now() - 15 * 60 * 1000);

    // Find orders with paymentStatus 'pending' created more than 15 minutes ago
    const expiredOrders = await SaleOrder.find({
        paymentStatus: 'pending',
        createdAt: { $lt: FIFTEEN_MINUTES_AGO }
    });
    if (expiredOrders.length === 0) {
        console.log('No expired orders found.');
        return;
    }

    for (const order of expiredOrders) {
        // Restore stock for each item in the order
        for (const item of order.items) {
            await ProductSale.updateOne(
                { _id: item.product, "variants._id": item.variantId, isDeleted: false },
                { $inc: { "variants.$.stock": item.qty } }
            );
        }

        // Cancel the order
        order.orderStatus = 'cancelled';
        order.paymentStatus = 'failed';
        order.cancelledAt = new Date();
        console.log(`Order ${order._id} cancelled and stock restored.`);
        await order.save();
    }
}

async function cancelAndRestockExpiredRentals() {
    const FIFTEEN_MINUTES_AGO = new Date(Date.now() - 15 * 60 * 1000);

    // Find rental bookings in 'pending' paymentStatus older than 15 minutes
    const expiredBookings = await RentBooking.find({
        paymentStatus: 'pending',
        createdAt: { $lt: FIFTEEN_MINUTES_AGO }
    });

    for (const booking of expiredBookings) {
        // Restore stock for each item variant in the booking
        for (const item of booking.items) {
            await ProductRent.updateOne(
                { _id: item.product, 'variants._id': item.variantId },
                { $inc: { 'variants.$.stock': item.qty } }
            );
        }

        // Mark booking as cancelled and failed payment
        booking.orderStatus = 'cancelled';
        booking.paymentStatus = 'failed';
        booking.cancelledAt = new Date();

        await booking.save();
    }
}






module.exports = {
    isValidId,
    effectivePriceOf,
    discountPctOf,
    calcShipping,
    applyCouponIfAny,
    loadProductAndVariant,
    buildOrderItemSnapshot,
    decrementStockAtomic,
    toInt,
    cancelAndRestockExpiredOrders,
    cancelAndRestockExpiredRentals
};