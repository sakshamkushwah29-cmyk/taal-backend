// controllers/rentCartController.js
const mongoose = require('mongoose');
const RentCart = require('../../models/RentCart');
const ProductRent = require('../../models/ProductRent');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
// const { recalcRentCartTotals } = require('../../utils/cartUtils');
const { successRes } = require('../../utils/responseFormatter');

// helper: find or create cart for user
async function findOrCreateCart(userId) {
    let cart = await RentCart.findOne({ user: userId });
    if (!cart) cart = await RentCart.create({ user: userId });
    return cart;
}

exports.getRentCart = catchAsync(async (req, res, next) => {
    const userId = req.user._id;

    // 🛒 Find Cart + populate product
    let cart = await RentCart.findOne({ user: userId }).populate("items.product");
    if (!cart) {
        return successRes(res, 200, true, "Cart is empty", {
            items: [],
            grossSubtotal: 0,
            totalDeposit: 0,
            totalPayable: 0,
            startDate: null,
            endDate: null
        });
    }

    let grossSubtotal = 0;
    let totalDeposit = 0;
    let totalPayable = 0;
    let isCartUpdated = false;

    const transformedItems = cart.items.map((item) => {
        const product = item.product;
        if (!product) return null; // product delete ho gaya

        // ✅ Find variant
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (!variant) return null; // variant delete ya unavailable ho gaya

        const rentPricePerDay = variant.price ?? product.rentPricePerDay;
        const deposit = product.deposit || 0;
        const lineTotal = rentPricePerDay * item.qty;

        // ✅ Price mismatch check & update
        if (item.rentPricePerDay !== rentPricePerDay ||
            item.deposit !== deposit ||
            item.lineTotal !== lineTotal) {
            item.rentPricePerDay = rentPricePerDay;
            item.deposit = deposit;
            item.lineTotal = lineTotal;
            isCartUpdated = true;
        }

        grossSubtotal += rentPricePerDay * item.qty;
        totalDeposit += deposit * item.qty;
        totalPayable += lineTotal;

        return {
            productId: product._id,
            title: product.title,
            variant: {
                id: variant._id,
                color: variant.color,
                size: variant.size,
                sku: variant.sku,
                stock: variant.stock,
                inStock: variant.stock > 0,
                image: variant.images?.[0] || null,
                rentPricePerDay,
            },
            qty: item.qty,
            lineTotal,
            deposit,
        };
    }).filter(Boolean);

    // ✅ Totals bhi update karo agar mismatch ho
    if (cart.grossSubtotal !== grossSubtotal ||
        cart.totalDeposit !== totalDeposit ||
        cart.totalPayable !== totalPayable) {
        cart.grossSubtotal = grossSubtotal;
        cart.totalDeposit = totalDeposit;
        cart.totalPayable = totalPayable;
        isCartUpdated = true;
    }

    // ✅ Agar koi bhi update hua hai to DB me save karo
    if (isCartUpdated) await cart.save();

    return successRes(res, 200, true, "Cart fetched successfully", {
        _id: cart._id,
        user: cart.user,
        items: transformedItems,
        grossSubtotal,
        totalDeposit,
        totalPayable: cart.totalPayable + cart.totalDeposit,
        returnableAmount: cart.totalDeposit,
        startDate: cart.startDate || null,
        endDate: cart.endDate || null
    });
});


exports.addItemToRentCart = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    let { productId, variantId, qty = 1, startDate, endDate } = req.body || {};

    // 🔹 1. Validation
    if (!productId || !variantId) {
        return next(new AppError("productId and variantId are required", 400));
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return next(new AppError("Invalid productId", 400));
    }
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
        return next(new AppError("Invalid variantId", 400));
    }

    qty = Number(qty);
    if (qty <= 0) {
        return next(new AppError("Qty must be greater than 0", 400));
    }

    // ✅ Date validation
    let normalizedStart = startDate ? new Date(startDate) : null;
    let normalizedEnd = endDate ? new Date(endDate) : null;

    if (normalizedStart && normalizedEnd) {
        if (isNaN(normalizedStart.getTime()) || isNaN(normalizedEnd.getTime())) {
            return next(new AppError("Invalid startDate or endDate format", 400));
        }
        if (normalizedEnd <= normalizedStart) {
            return next(new AppError("endDate must be greater than startDate", 400));
        }
    }

    // 🔹 2. Fetch product + variant
    const product = await ProductRent.findOne({ _id: productId, status: "active" }).lean();
    if (!product) return next(new AppError("Product not found", 404));

    const variant = product.variants.find(v => v._id.toString() === variantId);
    if (!variant) return next(new AppError("Variant not found", 404));

    if (variant.stock <= 0) {
        return next(new AppError("This variant is out of stock", 400));
    }

    // 🔹 3. Find or Create Cart
    const cart = await findOrCreateCart(userId);

    // 🔹 4. Find if SAME item (product + variant + date range) already exists
    const existingItem = cart.items.find(it =>
        String(it.product) === String(productId) &&
        String(it.variantId) === String(variantId) &&
        String(it.startDate || "") === String(normalizedStart || "") &&
        String(it.endDate || "") === String(normalizedEnd || "")
    );

    let newQty = qty;
    if (existingItem) newQty += existingItem.qty;

    // ✅ Stock validation
    if (newQty > variant.stock) {
        return next(new AppError(`Only ${variant.stock} item(s) available for rent`, 400));
    }

    const rentPricePerDay = variant.price ?? product.rentPricePerDay;
    const deposit = product.deposit || 0;

    if (existingItem) {
        existingItem.qty = newQty;
        existingItem.rentPricePerDay = rentPricePerDay;
        existingItem.deposit = deposit;
        existingItem.lineTotal = existingItem.qty * rentPricePerDay;
    } else {
        cart.items.push({
            product: product._id,
            variantId: variant._id,
            titleSnapshot: product.title,
            color: variant.color,
            size: variant.size,
            qty,
            rentPricePerDay,
            deposit,
            lineTotal: qty * rentPricePerDay,
            startDate: normalizedStart,
            endDate: normalizedEnd
        });
    }

    // 🔹 5. Recalculate Totals
    let grossSubtotal = 0;
    let totalDeposit = 0;
    let totalPayable = 0;

    cart.items.forEach(item => {
        grossSubtotal += item.qty * item.rentPricePerDay;
        totalDeposit += item.qty * item.deposit;
        totalPayable += item.lineTotal;
    });

    cart.grossSubtotal = grossSubtotal;
    cart.totalDeposit = totalDeposit;
    cart.totalPayable = totalPayable;

    await cart.save();

    return successRes(res, 201, true, "Item added to rent cart successfully", {
        items: cart.items,
        grossSubtotal: cart.grossSubtotal,
        totalDeposit: cart.totalDeposit,
        totalPayable: cart.totalPayable + cart.totalDeposit,
        returnableAmount: cart.totalDeposit
    });
});


exports.updateItemQty = catchAsync(async (req, res, next) => {
    // body: { productId, variantId, qty, startDate?, endDate? }
    const { productId, variantId, qty, startDate, endDate } = req.body || {};
    if (!productId || !variantId || typeof qty === 'undefined') return next(new AppError('productId, variantId and qty required', 400));

    const cart = await RentCart.findOne({ user: req.user._id });
    if (!cart) return next(new AppError('Cart not found', 404));

    const idx = cart.items.findIndex(it => String(it.product) === String(productId) && String(it.variantId) === String(variantId));
    if (idx === -1) return next(new AppError('Item not found in cart', 404));

    cart.items[idx].qty = Number(qty);
    if (startDate) cart.startDate = startDate;
    if (endDate) cart.endDate = endDate;

    recalcRentCartTotals(cart);
    await cart.save();
    return successRes(res, 200, true, 'Cart updated successfully', cart);
});

exports.removeItem = catchAsync(async (req, res, next) => {
    // body: { productId, variantId }
    const { productId, variantId } = req.body || {};
    if (!productId || !variantId) return next(new AppError('productId and variantId required', 400));

    const cart = await RentCart.findOne({ user: req.user._id });
    if (!cart) return next(new AppError('Cart not found', 404));

    cart.items = cart.items.filter(it => !(String(it.product) === String(productId) && String(it.variantId) === String(variantId)));
    recalcRentCartTotals(cart);
    await cart.save();
    return successRes(res, 200, true, 'Item removed from cart', cart);
});

exports.clearCart = catchAsync(async (req, res, next) => {
    const cart = await RentCart.findOne({ user: req.user._id });
    if (!cart) return next(new AppError('Cart not found', 404));
    cart.items = [];
    cart.startDate = undefined;
    cart.endDate = undefined;
    cart.grossSubtotal = 0;
    cart.totalDeposit = 0;
    cart.totalPayable = 0;
    await cart.save();
    return successRes(res, 200, true, 'Cart cleared', null);
});

// admin or user might want to fetch cart by id
exports.getCartById = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const cart = await RentCart.findById(id).lean();
    if (!cart) return next(new AppError('Cart not found', 404));
    return successRes(res, 200, true, 'Cart fetched successfully', cart);
});