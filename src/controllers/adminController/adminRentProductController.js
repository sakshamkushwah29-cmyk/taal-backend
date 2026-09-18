// controllers/productRentController.js
const mongoose = require('mongoose');
const ProductRent = require('../../models/ProductRent');
const catchAsync = require('../../utils/catchAsync');
const Category = require('../../models/Category');
const AppError = require('../../utils/AppError');
const validators = require('../../validations/productRentValidators');
const { successRes } = require('../../utils/responseFormatter');
const QueryBuilder = require('../../services/queryBuilder');

const DEFAULT_POPULATE = 'category';

exports.createRentProduct = catchAsync(async (req, res, next) => {
    let payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
        return next(new AppError('Request body is empty', 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // ✅ Category validation
        let categoryQb = new QueryBuilder(Category);
        const findCategory = await categoryQb.findOne({ _id: payload.category }).lean().exec();
        if (!findCategory) {
            return next(new AppError('Category not found', 404));
        }

        // ✅ Variants discountPrice validation & default handling
        if (Array.isArray(payload.variants)) {
            payload.variants = payload.variants.map(variant => {
                // agar discountPrice hi nahi bheja
                if (variant.discountPrice == null) {
                    variant.discountPrice = variant.price;
                }

                // agar discountPrice galat diya
                if (variant.discountPrice > variant.price) {
                    throw new AppError(
                        `Discounted price (${variant.discountPrice}) should be less than actual price (${variant.price}) for variant ${variant.color}-${variant.size}`,
                        400
                    );
                }

                return variant;
            });
        }

        // ✅ Create document
        const doc = new ProductRent(payload);
        await doc.save({ session }); // pre-validate hooks chalayenge stock/sku ke liye

        await session.commitTransaction();
        session.endSession();

        // ✅ Populate response
        let productQb = new QueryBuilder(ProductRent);
        const populated = await productQb.findOne({ _id: doc._id }).populate(DEFAULT_POPULATE).exec();
        return successRes(res, 201, true, 'Product created successfully', populated);

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(err.message, err.statusCode || 500));
    }
});

exports.getRentProducts = catchAsync(async (req, res, next) => {
    const { search, category, status, minPrice, maxPrice, tags, sort, page = 1, limit = 10 } = req.query;

    const qb = new QueryBuilder(ProductRent);

    // ---------- FILTER ----------
    let baseFilter = {};
    if (category) baseFilter.category = category;
    if (status) baseFilter.status = status;
    if (tags) {
        const tagArray = tags.split(",").map(t => t.trim()).filter(Boolean);
        if (tagArray.length) baseFilter.tags = { $in: tagArray };
    }

    qb.filter(baseFilter);

    // ---------- RANGE FILTER ----------
    qb.rangeFilter("rentPricePerDay", minPrice, maxPrice);

    // ---------- SEARCH ----------
    if (search) {
        qb.search(search, ["title", "sku", "description", "tags"]);
    }

    // ---------- SORT ----------
    let sortBy = { createdAt: -1 };
    if (sort) {
        try {
            const [field, order] = sort.split(":");
            sortBy = { [field]: order === "asc" ? 1 : -1 };
        } catch (e) {
            sortBy = { createdAt: -1 };
        }
    }
    qb.sort(sortBy);

    // ---------- PAGINATION ----------
    qb.paginate(page, limit);

    // ---------- POPULATE ----------
    qb.populate(DEFAULT_POPULATE);

    // ---------- EXECUTION ----------
    const [total, docs] = await Promise.all([
        qb.count(),
        qb.lean().exec()
    ]);

    return successRes(res, 200, true, "Products retrieved successfully", {
        totalDocument: total,
        pageNo: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
        data: docs,
    });
});

exports.getRentProduct = catchAsync(async (req, res, next) => {
    const productId = req.query?.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) return next(new AppError('Invalid product id', 400));
    let qb = new QueryBuilder(ProductRent);
    const doc = await qb.findOne({ _id: productId }).populate(DEFAULT_POPULATE).lean().exec();
    if (!doc) return next(new AppError('Product not found', 404));
    return successRes(res, 200, true, "Product retrieved successfully", doc);
});

exports.updateRentProduct = catchAsync(async (req, res, next) => {
    const productId = req.body?.productId;
    const value = req.body; // assuming updated data comes in body

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return next(new AppError('Invalid product id', 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let productQb = new QueryBuilder(ProductRent);
        // ✅ fetch as hydrated mongoose doc (not lean)
        const doc = await productQb.findOne({ _id: productId }).session(session).exec();

        if (!doc) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Product not found', 404));
        }

        // ✅ check SKU uniqueness if updated
        if (value.sku && value.sku !== doc.sku) {
            const exists = await ProductRent.findOne({ sku: value.sku, _id: { $ne: productId } }).lean();
            if (exists) {
                await session.abortTransaction();
                session.endSession();
                return next(new AppError('Product SKU already in use', 400));
            }
        }

        // ✅ assign new values into mongoose doc
        Object.assign(doc, value);

        // ✅ save with session (runs pre-validate for variants, stock, sku checks, etc.)
        await doc.save({ session });

        await session.commitTransaction();
        session.endSession();

        // ✅ fetch updated product with populate
        const updated = await productQb.findOne({ _id: productId }).populate(DEFAULT_POPULATE).exec();

        return successRes(res, 200, true, "Product updated successfully", updated);

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(new AppError(err.message, err.statusCode || 500));
    }
});

exports.deleteRentProduct = catchAsync(async (req, res, next) => {
    const productId = req.query.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) return next(new AppError('Invalid product id', 400));
    const productQb = new QueryBuilder(ProductRent);
    const doc = await productQb.findOne({ _id: productId }).exec();
    if (!doc) return next(new AppError('Product not found', 404));
    await productQb.delete({ _id: productId }).exec();
    return successRes(res, 200, true, 'Product deleted successfully', doc);
});

exports.restoreProduct = catchAsync(async (req, res, next) => {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid product id', 400));
    const doc = await ProductRent.findByIdAndUpdate(id, { isDeleted: false }, { new: true });
    if (!doc) return next(new AppError('Product not found', 404));
    return successRes(res, 200, true, 'Product restored successfully', doc);
});

/* ================= Variant CRUD ================= */

exports.addVariant = catchAsync(async (req, res, next) => {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) return next(new AppError('Invalid product id', 400));

    const { error, value } = validators.addVariantSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new AppError(error.details.map(d => d.message).join(', '), 400));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const product = await ProductRent.findById(productId).session(session);
        if (!product || product.isDeleted) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Product not found', 404));
        }

        // SKU uniqueness inside this product:
        if (value.sku) {
            const exists = product.variants.find(v => v.sku && v.sku === value.sku);
            if (exists) {
                await session.abortTransaction();
                session.endSession();
                return next(new AppError('Variant SKU already exists within product', 400));
            }
        }

        product.variants.push(value);
        // totalStock recomputed in pre('validate')
        await product.save({ session });
        await session.commitTransaction();
        session.endSession();

        const updated = await ProductRent.findById(productId).populate(DEFAULT_POPULATE);
        res.status(201).json({ status: 'success', data: updated });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});

exports.updateVariant = catchAsync(async (req, res, next) => {
    const { id: productId, variantId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
        return next(new AppError('Invalid id(s)', 400));
    }
    const { error, value } = validators.updateVariantSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new AppError(error.details.map(d => d.message).join(', '), 400));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const product = await ProductRent.findById(productId).session(session);
        if (!product || product.isDeleted) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Product not found', 404));
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Variant not found', 404));
        }

        // If sku changing - ensure no duplicate in other variants
        if (value.sku && value.sku !== variant.sku) {
            const dup = product.variants.find(v => v._id.toString() !== variantId && v.sku === value.sku);
            if (dup) {
                await session.abortTransaction();
                session.endSession();
                return next(new AppError('Variant SKU would duplicate another variant in this product', 400));
            }
        }

        Object.assign(variant, value);
        await product.save({ session }); // pre-validate updates totalStock and SKU checks
        await session.commitTransaction();
        session.endSession();

        const updated = await ProductRent.findById(productId).populate(DEFAULT_POPULATE);
        return successRes(res, 200, 'success', 'Variant updated successfully', updated);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});

exports.deleteVariant = catchAsync(async (req, res, next) => {
    const { id: productId, variantId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
        return next(new AppError('Invalid id(s)', 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const product = await ProductRent.findById(productId).session(session);
        if (!product || product.isDeleted) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Product not found', 404));
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError('Variant not found', 404));
        }

        variant.remove();
        await product.save({ session }); // recomputes totalStock
        await session.commitTransaction();
        session.endSession();

        const updated = await ProductRent.findById(productId).populate(DEFAULT_POPULATE);
        res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});

/* ================= Stock adjust (uses the model static) ================= */

exports.adjustVariantStock = catchAsync(async (req, res, next) => {
    const { id: productId, variantId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
        return next(new AppError('Invalid id(s)', 400));
    }
    const { error, value } = validators.adjustStockSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return next(new AppError(error.details.map(d => d.message).join(', '), 400));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // adjustVariantStock will findOneAndUpdate and ensure variant stock non-negative afterwards
        const updated = await ProductRent.adjustVariantStock(productId, variantId, value.delta, session);
        await session.commitTransaction();
        session.endSession();

        const populated = await ProductRent.findById(updated._id).populate(DEFAULT_POPULATE);
        return successRes(res, 200, true, 'Stock adjusted successfully', populated);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});


exports.activeDeactiveProduct = catchAsync(async (req, res, next) => {
    const {productId,status} = req.body
    if (!mongoose.Types.ObjectId.isValid(productId)) return next(new AppError('Invalid product id', 400));

    const product = await ProductRent.findById(productId);
    if (!product) return next(new AppError('Product not found', 404));
    product.status = status || product.status;
    await product.save();
    return successRes(res, 200, true, status === "active" ? 'Product active successfully' : 'Product inactive successfully', product);
});