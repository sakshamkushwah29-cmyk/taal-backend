const legalSchema = require("../../models/Leagal.modal");
const QueryBuilder = require("../../services/queryBuilder");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const { capitalizeWords } = require("../../utils/helper");
const { successRes } = require("../../utils/responseFormatter");

exports.createOrUpdatePolicy = catchAsync(async (req, res, next) => {
  const { type, title, content, version, isActive } = req.body;

  if (!type || !title || !content) {
    return next(new AppError("Type, Title and Content are required", 400));
  }

  // Check if already exists
  let doc = await legalSchema.findOne({ type });

  if (doc) {
    // 🔹 Update existing
    doc.title = title || doc.title;
    doc.content = content || doc.content;
    doc.version = version || doc.version;
    if (isActive !== undefined) doc.isActive = isActive;
    doc.updatedBy = req.user._id;

    await doc.save();

    return successRes(res, 200,true, `${type} updated successfully`, doc);
  } else {
    // 🔹 Create new
    doc = await legalSchema.create({
      type,
      title,
      content,
      version: version || "1.0",
      isActive: isActive !== undefined ? isActive : true,
    });

    return successRes(res, 201, true, `${type} created successfully`, doc);
  }
});

exports.getPolicy = catchAsync(async (req, res, next) => {
  const { type } = req.query;
  if (!type) return next(new AppError("Type is required", 400));
  const doc = await legalSchema.findOne({ type });
  if (!doc) return next(new AppError(`${capitalizeWords(type)} not found`, 404));
  return successRes(res, 200, true, `${capitalizeWords(type)} retrieved successfully`, doc);
});


exports.getAllPolicies = catchAsync(async (req, res, next) => {
  let policies = await legalSchema.find();
  if (!policies) return next(new AppError("Policies not found", 404));
  return successRes(res, 200, true, "Policies retrieved successfully", policies);
});