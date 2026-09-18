const ContactUs = require("../../models/contactUs");
const { successRes } = require("../../utils/responseFormatter");
const AppError = require("../../utils/AppError");
const catchAsync = require("../../utils/catchAsync");


module.exports.createContactUs = catchAsync(async (req, res, next) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return next(new AppError("Name, Email, and Message are required", 400));
    }
    const contactUs = await ContactUs.create({ name, email, message });
    return successRes(res, 201, true, "Message sent successfully", contactUs);
})



