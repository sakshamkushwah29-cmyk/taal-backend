const Category = require("../../models/Category");
const QueryBuilder = require("../../services/queryBuilder");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const { capitalizeWords } = require("../../utils/helper");
const { successRes } = require("../../utils/responseFormatter");

const createCategory = catchAsync(async (req, res, next) => {
    let { name, description, type, icon, parent } = req.body;

    name = name.trim();
    if (!name) {
        return next(new AppError("Category name is required", 400));
    }
    let capitalizedName = capitalizeWords(name);

    // 🔍 Check duplicate (case-insensitive)
    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp("^" + name + "$", "i") },
        isDeleted: { $ne: true }
    });

    if (existingCategory) {
        return next(new AppError("Category with this name already exists", 400));
    }

    const category = await Category.create({
        name: capitalizedName,
        description,
        type: type || "both",
        icon: icon || null,
        parent: parent || null
    });

    return successRes(res, 201, true, "Category created successfully", category);
});

const getCategories = catchAsync(async (req, res, next) => {
    let qb = new QueryBuilder(Category);
    let filterConditions = {};

    const { type, search, exact, page, limit } = req.query;

    if (type && type !== "all") {
        if (exact === "true") {
            filterConditions.type = type;
        } else if (type === "rental") {
            filterConditions.$or = [
                { type: { $in: ["rental", "both"] } },
                { type: { $exists: false } },
                { type: null }
            ];
        } else if (type === "sale") {
            filterConditions.$or = [
                { type: { $in: ["sale", "both"] } },
                { type: { $exists: false } },
                { type: null }
            ];
        } else if (type === "both") {
            filterConditions.$or = [
                { type: "both" },
                { type: { $exists: false } },
                { type: null }
            ];
        } else {
            filterConditions.type = type;
        }
    }

    qb.filter(filterConditions);

    if (search && search.trim()) {
        qb.search(search.trim(), ["name", "description"]);
    }

    if (page) {
        const p = Math.max(parseInt(page, 10) || 1, 1);
        const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
        const total = await qb.count();
        const categories = await qb.paginate(p, l).sort("-createdAt").exec();
        return successRes(res, 200, true, "Categories retrieved successfully", {
            data: categories,
            total,
            totalPages: Math.ceil(total / l) || 1,
            currentPage: p
        });
    }

    let categories = await qb.sort("-createdAt").exec();
    return successRes(res, 200, true, "Categories retrieved successfully", categories);
});

const getCategory = catchAsync(async (req, res, next) => {
    const { categoryId } = req.query;
    if (!categoryId) return next(new AppError("Category id is required", 400));
    const qb = new QueryBuilder(Category);
    const category = await qb.findOne({ _id: categoryId }).exec();
    if (!category) {
        return next(new AppError("Category not found", 404));
    }
    return successRes(res, 200, true, "Category retrieved successfully", category);
});

const updateCategory = catchAsync(async (req, res, next) => {
    const { categoryId } = req.body;
    if (!categoryId) return next(new AppError("Category id is required", 400));
    const qb = new QueryBuilder(Category);
    const category = await qb.findOne({ _id: categoryId }).exec();
    if (!category) {
        return next(new AppError("Category not found", 404));
    }
    category.name = req.body.name || category.name;
    category.description = req.body.description || category.description;
    if (req.body.type) {
        category.type = req.body.type;
    }
    if (req.body.icon !== undefined) {
        category.icon = req.body.icon;
    }
    if (req.body.parent !== undefined) {
        category.parent = req.body.parent;
    }
    await category.save();
    return successRes(res, 200, true, "Category updated successfully", category);
});

const deleteCategory = catchAsync(async (req, res, next) => {
    const { categoryId } = req.body;
    if (!categoryId) return next(new AppError("Category id is required", 400));
    const qb = new QueryBuilder(Category);
    const category = await qb.findOne({ _id: categoryId }).exec();
    if (!category) {
        return next(new AppError("Category not found", 404));
    }
    category.isDeleted = true;
    category.deletedAt = Date.now();
    await category.save();
    return successRes(res, 200, true, "Category deleted successfully", category);
});


module.exports = { createCategory, getCategories, getCategory, updateCategory, deleteCategory };