const catchAsync = require("../../utils/catchAsync");
const ProductSale = require("../../models/ProductSale");
const Category = require("../../models/Category");
const { successRes } = require("../../utils/responseFormatter");
const AppError = require("../../utils/AppError");
const QueryBuilder = require("../../services/queryBuilder");
const { default: mongoose } = require("mongoose");
const ENVIRONMENT = require("../../config/env");

exports.uploadProductImage = catchAsync(async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return next(new AppError("No files uploaded", 400));
    }
    let files = req.files;
    let response = files.map((file) => {
        return {
            originalName: file.originalname,
            fileName: file.filename,
            url: `${ENVIRONMENT.IMAGE_FILE_PATH}/productImages/${file.filename}`,
        };
    });
    return successRes(res, 201, true, "File uploaded successfully", response);
});

exports.createSaleProduct = catchAsync(async (req, res, next) => {
    let { title, category, description, tags, variants, gender } = req.body;

    if (!title) return next(new AppError("Title is required", 400));
    if (!category) return next(new AppError("Category is required", 400));
    if (!description) return next(new AppError("Description is required", 400));
    if (!tags) return next(new AppError("Tags is required", 400));
    if (!variants) return next(new AppError("Variants is required", 400));
    if (!gender) return next(new AppError("Gender is required", 400));

    if (!["men", "women", 'boys', 'girls', "unisex", "all"].includes(gender)) return next(new AppError("Gender is invalid", 400));

    let qb = new QueryBuilder(Category);
    let findCategory = await qb.findOne({ _id: category }).exec();
    if (!findCategory) {
        return next(new AppError("Category not found", 404));
    }

    // ✅ Variants me discountPrice set karna
    variants = variants.map(v => {
        if (!v.discountPrice || v.discountPrice === 0) {
            v.discountPrice = v.price;
        }
        return v;
    });

    const product = await ProductSale.create({
        title,
        category,
        description,
        tags,
        variants,
        gender
    });

    return successRes(res, 201, true, "Product created successfully", product);
});


exports.getAllSalesProducts = catchAsync(async (req, res, next) => {
    let { page = 1, limit = 10 } = req.query;
    let qb = new QueryBuilder(ProductSale);
    let products = await qb.aggregate([
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "category"
            }
        },
        {
            $skip: (page - 1) * limit
        },
        {
            $limit: limit
        }
    ]).exec();
    return successRes(res, 200, true, "Products retrieved successfully", products);
});

exports.getSaleProductById = catchAsync(async (req, res, next) => {
    const { productId } = req.query;
    if (!productId) return next(new AppError("Product id is required", 400));
    const qb = new QueryBuilder(ProductSale);
    const product = await qb.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(productId)
            }
        },
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "category"
            }
        }
    ]).exec();
    if (!product || product.length === 0) {
        return next(new AppError("Product not found", 404));
    }
    return successRes(res, 200, true, "Product retrieved successfully", product);
});

exports.updateSaleProduct = catchAsync(async (req, res, next) => {
    const { productId } = req.body;
    if (!productId) return next(new AppError("Product id is required", 400));
    const qb = new QueryBuilder(ProductSale);
    const product = await qb.findOne({ _id: productId }).exec();
    if (!product) {
        return next(new AppError("Product not found", 404));
    }
    if (req.body.category) {
        let qb = new QueryBuilder(Category);
        let findCategory = await qb.findOne({ _id: req.body.category }).exec();
        if (!findCategory) {
            return next(new AppError("Category not found", 404));
        }
    }
    product.title = req.body.title || product.title;
    product.category = req.body.category || product.category;
    product.description = req.body.description || product.description;
    product.tags = req.body.tags || product.tags;
    product.variants = req.body.variants || product.variants;
    await product.save();
    return successRes(res, 200, true, "Product updated successfully", product);
});

exports.activeDeactiveSaleProduct = catchAsync(async (req, res, next) => {
    const { productId, status } = req.body;
    console.log(productId, "productId");
    if (!productId) return next(new AppError("Product id is required", 400));
    const qb = new QueryBuilder(ProductSale);
    const product = await qb.findOne({ _id: productId }).exec();
    if (!product) {
        return next(new AppError("Product not found", 404));
    }
    product.status = status || product.status;
    await product.save();
    return successRes(res, 200, true, status === "active" ? "Product active successfully" : "Product inactive successfully", product);
});