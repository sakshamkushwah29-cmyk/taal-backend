const legalSchema = require("../../models/Leagal.modal");
const QueryBuilder = require("../../services/queryBuilder");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");
const { capitalizeWords } = require("../../utils/helper");
const { successRes } = require("../../utils/responseFormatter");

exports.getPolicy = catchAsync(async (req, res, next) => {
  const { type } = req.query;
  if (!type) return next(new AppError("Type is required", 400));
  const doc = await legalSchema.findOne({ type });
  if (!doc) return next(new AppError(`${capitalizeWords(type)} not found`, 404));
  return successRes(res, 200, true, `${capitalizeWords(type)} retrieved successfully`, doc);
});