const Category = require("../../models/Category");
const QueryBuilder = require("../../services/queryBuilder");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const { capitalizeWords } = require("../../utils/helper");
const { successRes } = require("../../utils/responseFormatter");

const createCategory = catchAsync(async (req, res, next) => {
    let { name, description, icon, parent } = req.body;

    name = name.trim();
    if (!name) {
        return next(new AppError("Category name is required", 400));
    }
    let capitalizedName = capitalizeWords(name);

    // 🔍 Check duplicate (case-insensitive)
    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp("^" + name + "$", "i") }
    });

    if (existingCategory) {
        return next(new AppError("Category with this name already exists", 400));
    }

    const category = await Category.create({
        name: capitalizedName,
        description,
        icon: icon || null,
        parent: parent || null
    });

    return successRes(res, 201, true, "Category created successfully", category);
});

const getCategories = catchAsync(async (req, res, next) => {
    let qb = new QueryBuilder(Category);
    let categories = await qb.filter().sort("-createdAt").exec();
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
    category.icon = req.body.icon || category.icon;
    category.parent = req.body.parent || category.parent;
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