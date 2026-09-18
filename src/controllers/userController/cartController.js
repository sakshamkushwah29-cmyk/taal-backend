const QueryBuilder = require("../../services/queryBuilder");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const SaleCart = require("../../models/SaleCart");
const ProductSale = require("../../models/ProductSale");
const { successRes } = require("../../utils/responseFormatter");

exports.addToCart = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    let { productId, variantId, qty } = req.body;

    if (!productId || !variantId || !qty) {
        return next(new AppError("Product, Variant and Qty are required", 400));
    }

    qty = Number(qty);
    if (qty <= 0) {
        return next(new AppError("Qty must be greater than 0", 400));
    }

    // 🔹 1. Fetch product + variant
    const product = await ProductSale.findOne({ _id: productId, status: "active" }).lean();
    if (!product) return next(new AppError("Product not found", 404));

    const variant = product.variants.find(v => v._id.toString() === variantId);
    if (!variant) return next(new AppError("Variant not found", 404));

    if (variant.stock <= 0) {
        return next(new AppError("This variant is out of stock", 400));
    }

    // 🔹 2. Fetch/Create Cart
    let cart = await SaleCart.findOne({ user: userId });
    if (!cart) {
        cart = new SaleCart({ user: userId, items: [] });
    }

    // 🔹 3. Check if item already exists in cart
    const existingItem = cart.items.find(
        item => item.product.toString() === productId && item.variantId.toString() === variantId
    );

    let newQty = qty;
    if (existingItem) {
        newQty += existingItem.qty;
    }

    // 🔹 4. Stock validation (total qty must not exceed available stock)
    if (newQty > variant.stock) {
        return next(new AppError(`Only ${variant.stock} item(s) available in stock`, 400));
    }

    const mrp = variant.price;
    const sellPrice = variant.discountPrice > 0 ? variant.discountPrice : variant.price;

    if (existingItem) {
        existingItem.qty = newQty;
        existingItem.lineTotal = existingItem.qty * sellPrice;
    } else {
        cart.items.push({
            product: productId,
            variantId,
            titleSnapshot: product.title,
            color: variant.color,
            size: variant.size,
            qty,
            mrp,
            sellPrice,
            lineTotal: qty * sellPrice
        });
    }

    // 🔹 5. Recalculate totals
    let grossSubtotal = 0;
    let discount = 0;
    let totalPayable = 0;

    cart.items.forEach(item => {
        grossSubtotal += item.qty * item.mrp;
        discount += item.qty * (item.mrp - item.sellPrice);
        totalPayable += item.lineTotal;
    });

    cart.grossSubtotal = grossSubtotal;
    cart.discount = discount;
    cart.totalPayable = totalPayable;

    await cart.save();

    return successRes(res, 201, true, "Product added to cart successfully", {
        items: cart.items,
        grossSubtotal: cart.grossSubtotal,
        discount: cart.discount,
        totalPayable: cart.totalPayable,
        coupon: cart.coupon || null
    });
});

exports.getCart = catchAsync(async (req, res, next) => {
    const userId = req.user._id;

    // 🛒 Cart find with products
    let cartQb = new QueryBuilder(SaleCart)
    cart = await cartQb.findOne({ user: userId }).populate("items.product").exec();
    if (!cart) {
        return successRes(res, 200, true, "Cart is empty", {
            items: [],
            grossSubtotal: 0,
            discount: 0,
            totalPayable: 0,
        });
    }

    let grossSubtotal = 0;
    let totalPayable = 0;
    let isCartUpdated = false;

    const transformedItems = cart.items.map((item) => {
        const product = item.product;
        const variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
        );

        if (!variant) {
            return null; // variant delete ya unavailable ho gaya
        }

        const mrp = variant.price;
        const sellPrice = variant.discountPrice && variant.discountPrice > 0
            ? variant.discountPrice
            : variant.price;

        const lineTotal = sellPrice * item.qty;

        // ✅ Agar DB me saved prices mismatch hai -> update kar do
        if (item.mrp !== mrp || item.sellPrice !== sellPrice || item.lineTotal !== lineTotal) {
            item.mrp = mrp;
            item.sellPrice = sellPrice;
            item.lineTotal = lineTotal;
            isCartUpdated = true;
        }

        grossSubtotal += mrp * item.qty;
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
                mrp,
                sellPrice,
            },
            qty: item.qty,
            lineTotal,
        };
    }).filter(Boolean);

    const discount = grossSubtotal - totalPayable;

    // ✅ Totals bhi update karo agar mismatch ho
    if (cart.grossSubtotal !== grossSubtotal || cart.totalPayable !== totalPayable || cart.discount !== discount) {
        cart.grossSubtotal = grossSubtotal;
        cart.totalPayable = totalPayable;
        cart.discount = discount;
        isCartUpdated = true;
    }

    // ✅ Agar koi bhi update hua hai to DB me save kar do
    if (isCartUpdated) {
        await cart.save();
    }

    return successRes(res, 200, true, "Cart retrieved successfully", {
        _id: cart._id,
        user: cart.user,
        items: transformedItems,
        grossSubtotal,
        discount,
        totalPayable,
        coupon: cart.coupon || null,
    });
});

exports.removeItemFromCart = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    const { productId, variantId } = req.body;

    if (!productId || !variantId) {
        return next(new AppError("ProductId and VariantId are required", 400));
    }

    // 🛒 Cart find
    let cartQb = new QueryBuilder(SaleCart)
    let cart = await cartQb.findOne({ user: userId }).populate("items.product").exec();

    if (!cart) {
        return next(new AppError("Cart not found", 404));
    }

    // 🔎 Item check
    const itemIndex = cart.items.findIndex(
        (item) =>
            item.product._id.toString() === productId.toString() &&
            item.variantId.toString() === variantId.toString()
    );

    if (itemIndex === -1) {
        return next(new AppError("Item not found in cart", 404));
    }

    // ❌ Remove item
    cart.items.splice(itemIndex, 1);

    // 🧮 Recalculate totals
    let grossSubtotal = 0;
    let totalPayable = 0;

    cart.items.forEach((item) => {
        const product = item.product;
        const variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
        );

        if (variant) {
            const mrp = variant.price;
            const sellPrice = variant.discountPrice && variant.discountPrice > 0
                ? variant.discountPrice
                : variant.price;

            grossSubtotal += mrp * item.qty;
            totalPayable += sellPrice * item.qty;

            // ✅ also update item fields in DB
            item.mrp = mrp;
            item.sellPrice = sellPrice;
            item.lineTotal = sellPrice * item.qty;
        }
    });

    const discount = grossSubtotal - totalPayable;

    cart.grossSubtotal = grossSubtotal;
    cart.totalPayable = totalPayable;
    cart.discount = discount;

    await cart.save();

    return successRes(res, 200, true, "Item removed from cart", {
        _id: cart._id,
        user: cart.user,
        items: cart.items,
        grossSubtotal,
        discount,
        totalPayable,
        coupon: cart.coupon || null,
    });
});

exports.clearCart = catchAsync(async (req, res, next) => {
    const userId = req.user._id;

    // 🛒 Cart find
    let cartQb = new QueryBuilder(SaleCart)
    let cart = await cartQb.findOne({ user: userId }).exec();

    if (!cart) {
        return next(new AppError("Cart not found", 404));
    }

    // 🧹 Empty cart
    cart.items = [];
    cart.grossSubtotal = 0;
    cart.discount = 0;
    cart.totalPayable = 0;
    cart.coupon = null;

    await cart.save();

    return successRes(res, 200, true, "Cart cleared successfully", {
        _id: cart._id,
        user: cart.user,
        items: [],
        grossSubtotal: 0,
        discount: 0,
        totalPayable: 0,
        coupon: null,
    });
});

exports.updateItemQuantity = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    const { productId, variantId, type } = req.body;
    // type: "increase" | "decrease"

    if (!productId || !variantId || !type) {
        return next(new AppError("ProductId, VariantId aur type required hai", 400));
    }

    if (type !== "increase" && type !== "decrease") {
        return next(new AppError("Invalid type", 400));
    };

    // ✅ Cart find karo
    let cartQb = new QueryBuilder(SaleCart);
    let cart = await cartQb.findOne({ user: userId }).populate("items.product").exec();

    if (!cart) {
        return next(new AppError("Cart not found", 404));
    }

    // ✅ Cart item find karo
    let item = cart.items.find(
        (i) => i.product._id.toString() === productId.toString() &&
            i.variantId.toString() === variantId.toString()
    );

    if (!item) {
        return next(new AppError("Item not found in cart", 404));
    }

    // ✅ Variant check karo (in case stock badal gaya ho)
    const product = item.product;
    const variant = product.variants.find(
        (v) => v._id.toString() === variantId.toString()
    );

    if (!variant) {
        return next(new AppError("Variant not available", 400));
    }

    if (type === "increase") {
        if (item.qty + 1 > variant.stock) {
            return next(new AppError("Not enough stock available", 400));
        }
        item.qty += 1;
    } else if (type === "decrease") {
        item.qty -= 1;
        if (item.qty <= 0) {
            // qty 0 ya negative → remove kar do
            cart.items = cart.items.filter(
                (i) => !(i.product._id.toString() === productId.toString() &&
                    i.variantId.toString() === variantId.toString())
            );
        }
    }

    // ✅ Prices & totals recalc
    let grossSubtotal = 0;
    let totalPayable = 0;

    cart.items.forEach((i) => {
        const v = i.product.variants.find(
            (vv) => vv._id.toString() === i.variantId.toString()
        );
        if (!v) return;

        const mrp = v.price;
        const sellPrice = v.discountPrice && v.discountPrice > 0 ? v.discountPrice : v.price;

        i.mrp = mrp;
        i.sellPrice = sellPrice;
        i.lineTotal = sellPrice * i.qty;

        grossSubtotal += mrp * i.qty;
        totalPayable += i.lineTotal;
    });

    cart.grossSubtotal = grossSubtotal;
    cart.totalPayable = totalPayable;
    cart.discount = grossSubtotal - totalPayable;

    await cart.save();

    return successRes(res, 200, true, "Cart quantity updated successfully", {
        _id: cart._id,
        user: cart.user,
        items: cart.items.map((i) => ({
            productId: i.product._id,
            title: i.product.title,
            variant: {
                id: i.variantId,
                sku: i.product.variants.find(v => v._id.toString() === i.variantId.toString())?.sku,
                stock: i.product.variants.find(v => v._id.toString() === i.variantId.toString())?.stock,
                inStock: i.product.variants.find(v => v._id.toString() === i.variantId.toString())?.stock > 0,
                mrp: i.mrp,
                sellPrice: i.sellPrice,
                image: i.product.variants.find(v => v._id.toString() === i.variantId.toString())?.images?.[0] || null
            },
            qty: i.qty,
            lineTotal: i.lineTotal,
        })),
        grossSubtotal: cart.grossSubtotal,
        discount: cart.discount,
        totalPayable: cart.totalPayable,
        coupon: cart.coupon || null,
    });
});





