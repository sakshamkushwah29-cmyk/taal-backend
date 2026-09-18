// controllers/productSale.controller.js
const mongoose = require('mongoose');
const ProductSale = require('../../models/ProductSale');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const { successRes, errorRes } = require('../../utils/responseFormatter');
const { loadProductAndVariant, buildOrderItemSnapshot, calcShipping, applyCouponIfAny, decrementStockAtomic, isValidId } = require('../../helper/productHelper');
const SaleOrder = require('../../models/SaleOrder');
const { createPaymentForOrder } = require('../commonController/checkoutController');
const Address = require('../../models/Address');
const QueryBuilder = require('../../services/queryBuilder');
const SaleCart = require('../../models/SaleCart');
const parseCSV = (val) =>
    typeof val === 'string'
        ? val.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(val) ? val : undefined;

const toBool = (v) => v === '1' || v === 'true' || v === true;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toInt = (v, d) => {
    const x = parseInt(v, 10);
    return Number.isFinite(x) && x > 0 ? x : d;
};
const parseBool = v => v === true || v === 'true' || v === '1';

const sortStages = (sortKey, mode = 'product') => {
    switch (sortKey) {
        case 'newest': return [{ $sort: { createdAt: -1, _id: 1 } }];
        case 'oldest': return [{ $sort: { createdAt: 1, _id: 1 } }];
        case 'price_asc': return mode === 'product'
            ? [{ $sort: { minPrice: 1, _id: 1 } }]
            : [{ $sort: { effectivePrice: 1, _id: 1 } }];
        case 'price_desc': return mode === 'product'
            ? [{ $sort: { minPrice: -1, _id: 1 } }]
            : [{ $sort: { effectivePrice: -1, _id: 1 } }];
        case 'discount_desc': return mode === 'product'
            ? [{ $sort: { maxDiscountPct: -1, _id: 1 } }]
            : [{ $sort: { discountPct: -1, _id: 1 } }];
        default: return [{ $sort: { createdAt: -1, _id: 1 } }];
    }
};

exports.saleProductList = catchAsync(async (req, res, next) => {
    const {
        page = 1,
        limit = 24,
        sort = 'relevance',
        mode = 'product', // product | variant
        q,
        category,
        tags,
        colors,
        sizes,
        minPrice,
        maxPrice,
        inStock,
        hasDiscount,
        status,
        gender // man | woman | unisex
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
    const skip = (pageNum - 1) * perPage;

    const tagList = parseCSV(tags);
    const colorList = parseCSV(colors);
    const sizeList = parseCSV(sizes);

    // ---- Product-level filters ----
    const productMatch = {};
    productMatch.status = status || 'active';

    if (category) {
        if (!mongoose.isValidObjectId(category)) {
            return next(new AppError('Invalid category id', 400));
        }
        productMatch.category = new mongoose.Types.ObjectId(category);
    }

    if (tagList && tagList.length) {
        productMatch.tags = { $in: tagList };
    }

    if (gender) {
        const g = String(gender).toLowerCase();
        const allowed = ['men', 'women', 'unisex', 'boys', 'girls'];
        if (!allowed.includes(g)) return next(new AppError('Invalid gender value', 400));
        productMatch.gender = g;
    }

    // ---- Variant-level filters ----
    const variantMatch = {};
    if (colorList && colorList.length) variantMatch['variants.color'] = { $in: colorList };
    if (sizeList && sizeList.length) variantMatch['variants.size'] = { $in: sizeList };
    if (toBool(inStock)) variantMatch['variants.stock'] = { $gt: 0 };
    if (toBool(hasDiscount)) variantMatch['variants.discountPrice'] = { $gt: 0 };

    // ---- Build pipeline ----
    const pipeline = [
        { $match: productMatch },
        { $unwind: '$variants' },
        Object.keys(variantMatch).length ? { $match: variantMatch } : null,
    ].filter(Boolean);

    // ✅ SMART SEARCH (works for “red chaniya”):
    // Split q into tokens; each token must appear in ANY of these fields:
    // product: title, description, tags
    // variant: variants.color, variants.size, variants.sku
    if (q && q.trim()) {
        const tokens = q.trim().split(/\s+/).slice(0, 6); // cap to 6 tokens for sanity
        const andClauses = tokens.map(tok => {
            const rx = new RegExp(escapeRegExp(tok), 'i');
            return {
                $or: [
                    { title: rx },
                    { description: rx },
                    { tags: rx },
                    { 'variants.color': rx },
                    { 'variants.size': rx },
                    { 'variants.sku': rx },
                ]
            };
        });
        pipeline.push({ $match: { $and: andClauses } });
    }

    // Compute prices/discount after search to avoid extra work
    pipeline.push(
        {
            $addFields: {
                effectivePrice: {
                    $cond: [
                        {
                            $and: [
                                { $ne: ['$variants.discountPrice', null] },
                                { $gt: ['$variants.discountPrice', 0] }
                            ]
                        },
                        '$variants.discountPrice',
                        '$variants.price'
                    ]
                },
                discountPct: {
                    $cond: [
                        {
                            $and: [
                                { $ne: ['$variants.discountPrice', null] },
                                { $gt: ['$variants.discountPrice', 0] },
                                { $gt: ['$variants.price', 0] }
                            ]
                        },
                        {
                            $multiply: [
                                {
                                    $divide: [
                                        { $subtract: ['$variants.price', '$variants.discountPrice'] },
                                        '$variants.price'
                                    ]
                                },
                                100
                            ]
                        },
                        0
                    ]
                }
            }
        },
        (minPrice || maxPrice) ? {
            $match: {
                effectivePrice: {
                    ...(minPrice ? { $gte: Number(minPrice) } : {}),
                    ...(maxPrice ? { $lte: Number(maxPrice) } : {})
                }
            }
        } : null
    );

    if (mode === 'variant') {
        pipeline.push(
            {
                $project: {
                    _id: 1,
                    title: 1,
                    slug: 1,
                    category: 1,
                    status: 1,
                    createdAt: 1,
                    variantId: '$variants._id',
                    color: '$variants.color',
                    size: '$variants.size',
                    sku: '$variants.sku',
                    stock: '$variants.stock',
                    images: '$variants.images',
                    price: '$variants.price',
                    discountPrice: '$variants.discountPrice',
                    effectivePrice: 1,
                    discountPct: 1
                }
            },
            ...sortStages(sort, 'variant'),
            {
                $facet: {
                    items: [{ $skip: skip }, { $limit: perPage }],
                    total: [{ $count: 'count' }]
                }
            }
        );

        const [{ items, total }] = await ProductSale.aggregate(pipeline.filter(Boolean));
        const totalItems = total?.[0]?.count || 0;
        let response = {
            page: pageNum,
            limit: perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
            mode: 'variant',
            items
        }
        return successRes(res, 200, true, 'Products fetched', response);
    }

    // ---- Product (regroup) ----
    pipeline.push(
        {
            $group: {
                _id: '$_id',
                title: { $first: '$title' },
                slug: { $first: '$slug' },
                description: { $first: '$description' },
                category: { $first: '$category' },
                tags: { $first: '$tags' },
                status: { $first: '$status' },
                createdAt: { $first: '$createdAt' },
                minPrice: { $min: '$effectivePrice' },
                maxPrice: { $max: '$effectivePrice' },
                maxDiscountPct: { $max: '$discountPct' },
                totalStock: { $sum: '$variants.stock' },
                variantCount: { $sum: 1 },
                firstImage: {
                    $first: {
                        $cond: [
                            { $gt: [{ $size: { $ifNull: ['$variants.images', []] } }, 0] },
                            { $arrayElemAt: ['$variants.images', 0] },
                            null
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 1,
                title: 1,
                slug: 1,
                description: 1,
                category: 1,
                tags: 1,
                status: 1,
                createdAt: 1,
                minPrice: 1,
                maxPrice: 1,
                totalStock: 1,
                variantCount: 1,
                maxDiscountPct: { $ifNull: ['$maxDiscountPct', 0] },
                thumbnail: '$firstImage'
            }
        },
        ...sortStages(sort, 'product'),
        {
            $facet: {
                items: [{ $skip: skip }, { $limit: perPage }],
                total: [{ $count: 'count' }]
            }
        }
    );

    const [{ items, total }] = await ProductSale.aggregate(pipeline.filter(Boolean));
    const totalItems = total?.[0]?.count || 0;
    let response = {
        page: pageNum,
        limit: perPage,
        totalItems,
        totalPages: Math.ceil(totalItems / perPage),
        mode: 'product',
        items
    }
    return successRes(res, 200, true, 'Products fetched', response);
});

exports.getSaleProductById = catchAsync(async (req, res, next) => {
    const { productId, variantId } = req.query;

    if (!productId) return next(new AppError('productId query parameter is required', 400));
    if (!mongoose.isValidObjectId(productId)) return next(new AppError('Invalid productId', 400));

    // fetch product (with category minimal)
    const product = await ProductSale.findById(productId)
        .populate('category', 'name slug')
        .lean();

    if (!product) return next(new AppError('Product not found', 404));

    // helpers
    const calcEffectivePrice = v => {
        const p = Number(v.price || 0);
        const dp = Number(v.discountPrice || 0);
        return dp && dp > 0 ? dp : p;
    };
    const calcDiscountPct = v => {
        const p = Number(v.price || 0);
        const dp = Number(v.discountPrice || 0);
        if (p > 0 && dp > 0) return ((p - dp) / p) * 100;
        return 0;
    };

    // ensure variants array
    const rawVariants = Array.isArray(product.variants) ? product.variants : [];

    // compute runtime fields per variant
    const variants = rawVariants.map(v => {
        const effectivePrice = calcEffectivePrice(v);
        const discountPct = calcDiscountPct(v);
        const stock = Number(v.stock || 0);
        const inStock = stock > 0;
        return {
            variantId: v._id ? String(v._id) : null,
            color: v.color || null,
            size: v.size || null,
            sku: v.sku || null,
            price: Number(v.price || 0),
            discountPrice: Number(v.discountPrice || 0),
            effectivePrice,
            discountPct: Number(discountPct.toFixed(2)),
            stock,
            inStock,
            images: Array.isArray(v.images) ? v.images : [],
            raw: v // optional: raw fields if you need more later
        };
    });

    // pricing & stock summary
    const effectivePrices = variants.map(v => v.effectivePrice).filter(p => typeof p === 'number');
    const minPrice = effectivePrices.length ? Math.min(...effectivePrices) : 0;
    const maxPrice = effectivePrices.length ? Math.max(...effectivePrices) : 0;
    const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

    // build variant options & matrix: colors, sizes, colorSummary
    const colorsSet = new Set();
    const sizesSet = new Set();
    const matrix = {}; // matrix[color][size] => variant info
    const colorSummary = {}; // color -> { totalStock, minPrice, thumbnail }

    for (const v of variants) {
        const c = (v.color || 'other').toString();
        const s = (v.size || 'free').toString();
        colorsSet.add(c);
        sizesSet.add(s);

        matrix[c] = matrix[c] || {};
        matrix[c][s] = {
            variantId: v.variantId,
            sku: v.sku,
            price: v.price,
            discountPrice: v.discountPrice,
            effectivePrice: v.effectivePrice,
            discountPct: v.discountPct,
            stock: v.stock,
            inStock: v.inStock,
            images: v.images
        };

        if (!colorSummary[c]) {
            colorSummary[c] = { totalStock: 0, minPrice: v.effectivePrice, thumbnail: v.images && v.images[0] ? v.images[0] : null };
        }
        colorSummary[c].totalStock += v.stock || 0;
        if (v.effectivePrice < (colorSummary[c].minPrice || Infinity)) {
            colorSummary[c].minPrice = v.effectivePrice;
            if (v.images && v.images[0]) colorSummary[c].thumbnail = v.images[0];
        }
    }

    const availableColors = Array.from(colorsSet);
    const availableSizes = Array.from(sizesSet);

    // Determine selected/default variant
    let selectedVariant = null;
    let selectedVariantId = null;

    if (variantId) {
        if (!mongoose.isValidObjectId(variantId)) return next(new AppError('Invalid variantId', 400));
        selectedVariant = variants.find(v => v.variantId === String(variantId));
        if (!selectedVariant) return next(new AppError('Variant not found for this product', 404));
        selectedVariantId = selectedVariant.variantId;
    } else {
        // default selection logic:
        // 1) prefer in-stock variants (lowest effectivePrice among in-stock)
        // 2) if none in stock, choose absolute lowest effectivePrice
        const inStockVariants = variants.filter(v => v.inStock);
        if (inStockVariants.length) {
            inStockVariants.sort((a, b) => a.effectivePrice - b.effectivePrice);
            selectedVariant = inStockVariants[0];
        } else if (variants.length) {
            variants.sort((a, b) => a.effectivePrice - b.effectivePrice);
            selectedVariant = variants[0];
        }
        selectedVariantId = selectedVariant ? selectedVariant.variantId : null;
    }

    // Build response; keep heavy fields (raw) optional — here we include variants (computed) for UI
    const response = {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        category: product.category || null,
        tags: product.tags || [],
        gender: product.gender || null,
        status: product.status || null,
        createdAt: product.createdAt,

        pricing: {
            minPrice,
            maxPrice,
            totalStock
        },

        variantsCount: variants.length,
        availableColors,
        availableSizes,
        colorSummary,   // per-color quick info (thumbnail, minPrice, totalStock)
        matrix,         // matrix[color][size] => variant info (for UI selection)
        variants,       // full list of computed variants (good for listing/selecting)
        defaultVariantId: selectedVariantId, // UI can use this as the default selected
        selectedVariantId,
        selectedVariant: selectedVariant || null
    };

    return successRes(res, 200, true, "Product found", response);
});

/* ============================== BUY NOW ============================== */
/**
 * POST /checkout/buy-now
 * Body: { productId, variantId, qty, addressId, paymentMethod, coupon }
 * - paymentMethod: 'cod' | 'online'
 * - Creates a single-item order, decrements stock atomically, snapshots price.
 * - For 'online', you can integrate gateway & return paymentIntent (placeholder shown).
 */
exports.buyNow = catchAsync(async (req, res, next) => {
    const userId = req.user?._id;
    const { productId, variantId, qty = 1, addressId, paymentMethod, coupon, gateway = 'razorpay' } = req.body;

    if (!userId) return next(new AppError('Unauthorized', 401));
    if (!isValidId(productId) || !isValidId(variantId)) return next(new AppError('Invalid productId or variantId', 400));
    if (!isValidId(addressId)) return next(new AppError('Invalid addressId', 400));
    if (!['cod', 'online'].includes(String(paymentMethod))) return next(new AppError('Invalid paymentMethod', 400));

    const quantity = Math.max(1, Number(qty));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let addressQb = new QueryBuilder(Address)
        let findAddress = await addressQb.findOne({ _id: addressId }).session(session).exec()
        if (!findAddress) {
            throw new AppError('Address Not Found')
        }
        // 1) Load product+variant
        const { product, variant } = await loadProductAndVariant(productId, variantId, session);

        // 2) Validate stock
        if (Number(variant.stock || 0) < quantity) {
            throw new AppError('Insufficient stock', 400);
        }

        // 3) Build order item snapshot
        const line = buildOrderItemSnapshot({ product, variant, qty: quantity });

        // 4) Compute totals
        const subtotal = line.priceSnapshot * line.qty; // MRP*qty
        const itemsTotal = line.total; // effective * qty
        const { coupon: appliedCoupon, discountAmount } = await applyCouponIfAny({
            couponCode: coupon, userId, items: [line], subtotal: itemsTotal
        });
        const shippingCharges = calcShipping(itemsTotal - discountAmount);
        const grandTotal = Math.max(0, itemsTotal - discountAmount + shippingCharges);

        // 5) Atomic stock decrement
        const ok = await decrementStockAtomic({ productId, variantId, qty: quantity, session });
        if (!ok) throw new AppError('Stock changed, please try again', 409);

        // 6) Create order
        const [order] = await SaleOrder.create([{
            user: userId,
            items: [line],
            subtotal: itemsTotal,
            shippingCharges,
            total: grandTotal,
            address: addressId,
            paymentMethod,
            paymentStatus: 'pending', // webhook se update hoga
            currency: "INR",
            notes: appliedCoupon ? `Coupon: ${appliedCoupon}, Discount: ${discountAmount}` : undefined
        }], { session });

        // 7) Commit order to DB before payment intent
        await session.commitTransaction();
        session.endSession();

        let payment = null;

        // 8) Create payment intent if online
        if (paymentMethod === 'online') {
            payment = await createPaymentForOrder({
                order,
                user: req.user,
                gateway
            });

            // update order with paymentIntentId for reconciliation
            await SaleOrder.findByIdAndUpdate(order._id, {
                paymentIntentId: payment?.razorpayOrder?.id || null,
                paymentGateway: gateway
            });
        }
        return successRes(res, 201, true, "Order Created Successfull", { status: paymentMethod === 'online' ? 'pending' : 'success', order, payment })

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});


/* ======================== CART → CHECKOUT ======================== */
/**
 * POST /checkout/from-cart
 * Body: { addressId, paymentMethod, coupon }
 * - Takes **entire user cart** and attempts to place one order.
 * - Re-prices cart lines from live product data (anti-tamper).
 * - All-or-nothing: if any line invalid/out-of-stock → 409 with details.
 */
exports.placeOrderFromCart = catchAsync(async (req, res, next) => {
    const userId = req.user?._id;
    const { addressId, paymentMethod, gateway, coupon } = req.body;

    if (!userId) return next(new AppError('Unauthorized', 401));
    if (!isValidId(addressId)) return next(new AppError('Invalid addressId', 400));
    if (!['cod', 'online'].includes(String(paymentMethod))) return next(new AppError('Invalid paymentMethod', 400));

    let addressQb = new QueryBuilder(Address)
    let findAddress = await addressQb.findOne({ _id: addressId }).exec()
    if (!findAddress) {
        return next(new AppError('Address Not Found'))
    }

    // Load cart
    let cartQb = new QueryBuilder(SaleCart)
    const cart = await cartQb.findOne({ user: userId }).exec();
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        return next(new AppError('Cart is empty', 400));
    }

    // Build fresh order lines with live data
    const lines = [];
    const invalids = [];

    // We’ll keep a map to group updates by product for later efficiency (optional)
    for (const item of cart.items) {
        const { product, variantId, qty } = item;
        if (!isValidId(product) || !isValidId(variantId) || !qty) {
            invalids.push({ product, variantId, reason: 'Invalid ids or qty' });
            continue;
        }

        // fetch fresh product/variant to re-price & re-stock check
        const prod = await ProductSale.findById(product);
        if (!prod) { invalids.push({ product, variantId, reason: 'Product not found' }); continue; }
        const varr = prod.variants.id(variantId);
        if (!varr) { invalids.push({ product, variantId, reason: 'Variant not found' }); continue; }

        if (Number(varr.stock || 0) < Number(qty)) {
            invalids.push({ product, variantId, reason: 'Insufficient stock', available: varr.stock || 0 });
            continue;
        }

        lines.push(buildOrderItemSnapshot({ product: prod, variant: varr, qty }));
    }

    if (invalids.length) {
        return res.status(409).json({
            status: 'error',
            message: 'Some items are unavailable or invalid',
            invalids
        });
    }

    // Totals
    const itemsTotal = lines.reduce((s, l) => s + l.total, 0);
    const { coupon: appliedCoupon, discountAmount } = await applyCouponIfAny({
        couponCode: coupon, userId, items: lines, subtotal: itemsTotal
    });
    const shippingCharges = calcShipping(itemsTotal - discountAmount);
    const grandTotal = Math.max(0, itemsTotal - discountAmount + shippingCharges);

    // Transaction: decrement stocks atomically & create order; clear cart
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // 1) Decrement all stocks (fail fast on first failure)
        for (const l of lines) {
            const ok = await decrementStockAtomic({
                productId: l.product,
                variantId: l.variantId,
                qty: l.qty,
                session
            });
            if (!ok) throw new AppError('Stock changed, please review cart', 409);
        }

        // 2) Create order
        const [order] = await SaleOrder.create([{
            user: userId,
            items: lines,
            subtotal: itemsTotal,
            shippingCharges,
            total: grandTotal,
            address: addressId,
            paymentMethod,
            paymentGateway: gateway,
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending', // mark 'paid' post webhook
            notes: appliedCoupon ? `Coupon: ${appliedCoupon}, Discount: ${discountAmount}` : undefined
        }], { session });

        // 3) Clear cart (or remove purchased items)
        cart.items = [];
        cart.grossSubtotal = 0;
        cart.discount = 0;
        cart.totalPayable = 0;
        cart.coupon = null;
        await cart.save({ session });

        // 4) Payment intent (if online)
        let payment = null;
        if (paymentMethod === 'online') {
            payment = await createPaymentForOrder({
                order,
                user: req.user,
                gateway
            });

            // update order with paymentIntentId for reconciliation
            await SaleOrder.findByIdAndUpdate(order._id, {
                paymentIntentId: payment?.razorpayOrder?.id || null,
                paymentGateway: gateway
            });
        }

        await session.commitTransaction();
        session.endSession();
        return successRes(res, 201, true, 'Order created successfully', { order: order, payment });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(err.message, 500));
    }
});

/* ============================== PREVIEW (optional but useful) ============================== */
/**
 * GET /checkout/preview
 * - Returns live repriced totals for:
 *   a) ?buyNow=1&productId=&variantId=&qty=
 *   b) (default) user cart
 * - Great for showing final summary before placing order.
 */
exports.previewCheckout = catchAsync(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const { buyNow, productId, variantId, qty = 1, coupon } = req.query;

    let lines = [];

    if (String(buyNow) === '1') {
        if (!isValidId(productId) || !isValidId(variantId)) {
            return next(new AppError('Invalid productId or variantId', 400));
        }
        const prod = await ProductSale.findById(productId);
        if (!prod) return next(new AppError('Product not found', 404));
        const varr = prod.variants.id(variantId);
        if (!varr) return next(new AppError('Variant not found', 404));

        lines.push(buildOrderItemSnapshot({ product: prod, variant: varr, qty: Math.max(1, Number(qty)) }));
    } else {
        const cart = await SaleCart.findOne({ user: userId });
        if (!cart || !cart.items?.length) return next(new AppError('Cart is empty', 400));
        for (const item of cart.items) {
            const prod = await ProductSale.findById(item.product);
            if (!prod) continue;
            const varr = prod.variants.id(item.variantId);
            if (!varr) continue;
            lines.push(buildOrderItemSnapshot({ product: prod, variant: varr, qty: item.qty }));
        }
    }

    const itemsTotal = lines.reduce((s, l) => s + l.total, 0);
    const { coupon: appliedCoupon, discountAmount, reason } = await applyCouponIfAny({
        couponCode: coupon, userId, items: lines, subtotal: itemsTotal
    });
    const shippingCharges = calcShipping(itemsTotal - discountAmount);
    const grandTotal = Math.max(0, itemsTotal - discountAmount + shippingCharges);
    return successRes(res, 200, true, 'Checkout preview', {
        items: lines,
        totals: {
            itemsTotal,
            couponApplied: appliedCoupon,
            couponDiscount: discountAmount,
            shippingCharges,
            grandTotal
        },
        notes: reason || undefined
    });
});

/**
 * GET /api/v1/orders (USER)
 * Query:
 *  - page=1&limit=10
 *  - sort=newest|oldest|total_asc|total_desc
 *  - q= free text on id/receipt/sku/title
 *  - orderStatus=placed|packed|shipped|delivered|cancelled|returned
 *  - paymentStatus=pending|paid|failed|refunded
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 *  - includeCancelled=true|false (default false)
 */
exports.getMyOrders = catchAsync(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const {
        page = 1,
        limit = 10,
        sort = 'newest',
        q,
        orderStatus,
        paymentStatus,
        from,
        to,
        includeCancelled
    } = req.query;

    const pageNum = toInt(page, 1);
    const perPage = Math.min(toInt(limit, 10), 100);
    const skip = (pageNum - 1) * perPage;

    // base match
    const match = {
        user: new mongoose.Types.ObjectId(userId),
        isDeleted: { $ne: true }
    };

    // filters
    if (orderStatus) match.orderStatus = orderStatus;
    if (paymentStatus) match.paymentStatus = paymentStatus;

    // date range (createdAt)
    if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = new Date(from + 'T00:00:00.000Z');
        if (to) match.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    // exclude cancelled by default
    if (!parseBool(includeCancelled)) {
        match.orderStatus = match.orderStatus || { $ne: 'cancelled' };
    }

    // search (q): by _id (order id), receipt (we used _id as receipt in earlier examples), item sku/title snapshot
    const pipeline = [
        { $match: match },

        // textual search
        ...(q && q.trim()
            ? [{
                $match: {
                    $or: [
                        { _id: isValidId(q) ? new mongoose.Types.ObjectId(q) : null },
                        { notes: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                        { 'items.skuSnapshot': new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                        { 'items.titleSnapshot': new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                    ]
                }
            }]
            : []),

        // cover image using FIRST item’s product+variant (cheap card)
        {
            $addFields: {
                firstItem: { $arrayElemAt: ['$items', 0] }
            }
        },
        {
            $lookup: {
                from: 'productsales',
                let: {
                    pid: '$firstItem.product',
                    vid: '$firstItem.variantId'
                },
                pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
                    {
                        $project: {
                            // get first matching variant’s first image
                            thumb: {
                                $let: {
                                    vars: {
                                        variant: {
                                            $first: {
                                                $filter: {
                                                    input: '$variants',
                                                    as: 'v',
                                                    cond: { $eq: ['$$v._id', '$$vid'] }
                                                }
                                            }
                                        }
                                    },
                                    in: {
                                        $cond: [
                                            { $gt: [{ $size: { $ifNull: ['$$variant.images', []] } }, 0] },
                                            { $arrayElemAt: ['$$variant.images', 0] },
                                            null
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ],
                as: 'cover'
            }
        },
        {
            $addFields: {
                coverImage: { $ifNull: [{ $arrayElemAt: ['$cover.thumb', 0] }, null] }
            }
        },

        // compact card data
        {
            $project: {
                _id: 1,
                createdAt: 1,
                orderStatus: 1,
                paymentStatus: 1,
                paymentGateway: 1,
                total: 1,
                subtotal: 1,
                shippingCharges: 1,
                currency: 1,
                itemsCount: { $size: { $ifNull: ['$items', []] } },
                // snapshot summary
                firstItem: {
                    title: '$firstItem.titleSnapshot',
                    color: '$firstItem.colorSnapshot',
                    size: '$firstItem.sizeSnapshot',
                    qty: '$firstItem.qty',
                    sku: '$firstItem.skuSnapshot'
                },
                coverImage: 1
            }
        },

        // sorting
        ...(() => {
            switch (sort) {
                case 'oldest': return [{ $sort: { createdAt: 1, _id: 1 } }];
                case 'total_asc': return [{ $sort: { total: 1, _id: 1 } }];
                case 'total_desc': return [{ $sort: { total: -1, _id: 1 } }];
                default: return [{ $sort: { createdAt: -1, _id: 1 } }];
            }
        })(),

        // paginate + total
        {
            $facet: {
                items: [{ $skip: skip }, { $limit: perPage }],
                total: [{ $count: 'count' }]
            }
        }
    ];

    const [{ items, total }] = await SaleOrder.aggregate(pipeline);
    const totalItems = total?.[0]?.count || 0;
    return successRes(res, 200, true, 'Order list fetched', {
        page: pageNum,
        limit: perPage,
        totalItems,
        totalPages: Math.ceil(totalItems / perPage),
        items
    })
});


/**
 * GET /api/v1/orders/:orderId (USER)
 * - Full order detail with per-line current product/variant thumbnail
 * - Uses snapshots for pricing/title, so old orders don’t break
 */
exports.getMyOrderById = catchAsync(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const { orderId } = req.query;
    if (!isValidId(orderId)) return next(new AppError('Invalid orderId', 400));

    const pipeline = [
        {
            $match: {
                _id: new mongoose.Types.ObjectId(orderId),
                user: new mongoose.Types.ObjectId(userId),
                isDeleted: { $ne: true }
            }
        },
        { $limit: 1 },

        // ----- lookup for address -----
        {
            $lookup: {
                from: 'addresses',
                localField: 'address',
                foreignField: '_id',
                as: 'addressData'
            }
        },
        {
            $addFields: {
                address: { $arrayElemAt: ['$addressData', 0] }
            }
        },
        { $project: { addressData: 0 } },

        // Unwind items to lookup per line
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: 'productsales',
                let: { pid: '$items.product', vid: '$items.variantId' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
                    {
                        $project: {
                            productId: '$_id',
                            slug: 1,
                            title: 1,
                            variant: {
                                $first: {
                                    $filter: {
                                        input: '$variants',
                                        as: 'v',
                                        cond: { $eq: ['$$v._id', '$$vid'] }
                                    }
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            productId: 1,
                            slug: 1,
                            title: 1,
                            image: {
                                $cond: [
                                    { $gt: [{ $size: { $ifNull: ['$variant.images', []] } }, 0] },
                                    { $arrayElemAt: ['$variant.images', 0] },
                                    null
                                ]
                            },
                            currentPrice: '$variant.price',
                            currentDiscountPrice: '$variant.discountPrice',
                            currentStock: '$variant.stock',
                            currentSKU: '$variant.sku',
                            currentColor: '$variant.color',
                            currentSize: '$variant.size'
                        }
                    }
                ],
                as: 'prod'
            }
        },

        // Merge looked-up product data into item
        {
            $addFields: {
                'items.image': { $arrayElemAt: ['$prod.image', 0] },
                'items.current': {
                    price: { $arrayElemAt: ['$prod.currentPrice', 0] },
                    discountPrice: { $arrayElemAt: ['$prod.currentDiscountPrice', 0] },
                    stock: { $arrayElemAt: ['$prod.currentStock', 0] },
                    sku: { $arrayElemAt: ['$prod.currentSKU', 0] },
                    color: { $arrayElemAt: ['$prod.currentColor', 0] },
                    size: { $arrayElemAt: ['$prod.currentSize', 0] },
                    slug: { $arrayElemAt: ['$prod.slug', 0] }
                }
            }
        },

        // Regroup items
        {
            $group: {
                _id: '$_id',
                doc: { $first: '$$ROOT' },
                items: { $push: '$items' }
            }
        },
        {
            $replaceRoot: {
                newRoot: {
                    _id: '$_id',
                    user: '$doc.user',
                    address: '$doc.address',  // yaha already lookup wala full address aa gaya
                    paymentMethod: '$doc.paymentMethod',
                    paymentStatus: '$doc.paymentStatus',
                    paymentGateway: '$doc.paymentGateway',
                    paymentIntentId: '$doc.paymentIntentId',
                    orderStatus: '$doc.orderStatus',
                    notes: '$doc.notes',
                    shipment: '$doc.shipment',
                    subtotal: '$doc.subtotal',
                    shippingCharges: '$doc.shippingCharges',
                    total: '$doc.total',
                    currency: '$doc.currency',
                    createdAt: '$doc.createdAt',
                    updatedAt: '$doc.updatedAt',
                    packedAt: '$doc.packedAt',
                    shippedAt: '$doc.shippedAt',
                    deliveredAt: '$doc.deliveredAt',
                    returnedAt: '$doc.returnedAt',
                    cancelledAt: '$doc.cancelledAt',
                    items: '$items'
                }
            }
        },

        // add timeline
        {
            $addFields: {
                timeline: [
                    { label: 'Placed', at: '$createdAt', done: true },
                    {
                        label: 'Packed',
                        at: '$packedAt',
                        done: { $cond: [{ $ifNull: ['$packedAt', false] }, true, false] }
                    },
                    {
                        label: 'Shipped',
                        at: '$shippedAt',
                        done: { $cond: [{ $ifNull: ['$shippedAt', false] }, true, false] }
                    },
                    {
                        label: 'Delivered',
                        at: '$deliveredAt',
                        done: { $cond: [{ $ifNull: ['$deliveredAt', false] }, true, false] }
                    }
                ]
            }
        }
    ];

    const data = await SaleOrder.aggregate(pipeline);
    if (!data || !data[0]) return next(new AppError('Order not found', 404));

    return successRes(res, 200, true, 'Order fetched', data[0]);
});





