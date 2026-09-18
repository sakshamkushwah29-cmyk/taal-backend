const ContactUs = require("../../models/contactUs");
const { successRes } = require("../../utils/responseFormatter");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");

module.exports.getAllContactUs = catchAsync(async (req, res, next) => {
    let { page, type } = req.query;
    let limit  = 10;
    let skip = (page - 1) * limit;
    let query = {};
    if (type) {
        query.status = type;
    }

    const [totalContactUs, contactUs] = Promise.all([
        ContactUs.countDocuments({ ...query }),
        ContactUs.find({ ...query }).sort({ createdAt: -1 }).skip(skip).limit(limit)
    ])
    return successRes(res, 200, true, "Contact Us fetched successfully", {
        totalContactUs,
        pageNo: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalContactUs / limit),
        data: contactUs,
    });
});