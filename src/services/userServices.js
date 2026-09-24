// src/services/userService.js
const { EMAIL_VERIFICATION_LINK, FORGET_PASSWORD_LINK } = require("../config/env");
const { ForgotPasswordTemplate } = require("../emailTemplates/forgetPasswordTemplate");
const { EmailVerificationTemplate } = require("../emailTemplates/userVerificationTemplate");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/jwt");
const sendMail = require("../utils/sendMail");
const QueryBuilder = require("./queryBuilder");


class UserService {

    static async createUser({ name, email, phone, password }) {
        // 1️⃣ Check required fields (optional - if already validated in controller, skip this)
        if (!name || !email || !phone || !password) {
            throw new AppError("Name, Email, Phone, and Password are required", 400);
        }

        // Normalize email so lookups match the lowercased value persisted by the schema.
        const normalizedEmail = String(email).toLowerCase().trim();
        const normalizedPhone = String(phone).trim();

        // 2️⃣ Check if email OR phone already exists in one go
        const existingUsers = await new QueryBuilder(User)
            .filter({ $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] })
            .exec();

        if (existingUsers.length > 0) {
            const emailTaken = existingUsers.some(u => u.email === normalizedEmail);
            const phoneTaken = existingUsers.some(u => u.phone === normalizedPhone);
            if (emailTaken) throw new AppError("Email already exists", 409);
            if (phoneTaken) throw new AppError("Phone already exists", 409);
        }

        // 3️⃣ Create user
        const user = await new QueryBuilder(User)
            .create({
                name,
                email: normalizedEmail,
                phone: normalizedPhone,
                passwordHash: password // plain password; hashing handled by schema middleware
            })
            .exec();

        // 4️⃣ Generate verification token & link
        const token = signToken(user._id, user.email);
        user.verificationToken = token;
        await user.save(); // ensure token is saved before sending email

        const verificationLink = `${EMAIL_VERIFICATION_LINK}/${token}`;
        const template = EmailVerificationTemplate(user.name, verificationLink);

        // 5️⃣ Send verification email
        try {
            const mailResult = await sendMail({
                to: user.email,
                subject: "Email Verification - Taal Events",
                template
            });
            if (!mailResult.success) {
                console.warn("Verification email could not be delivered immediately for:", user.email, mailResult.error);
            }
        } catch (mailErr) {
            console.error("Error sending verification email:", mailErr);
        }

        return user;
    }

    static async resendVerificationEmail(email) {
        const normalizedEmail = String(email).toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) throw new AppError("No account found with this email", 404);
        if (user.isVerified) throw new AppError("Email is already verified", 400);
        if (user.isBlocked) throw new AppError("Your account has been blocked", 401);

        const token = signToken(user._id, user.email);
        user.verificationToken = token;
        await user.save();

        const verificationLink = `${EMAIL_VERIFICATION_LINK}/${token}`;
        const template = EmailVerificationTemplate(user.name, verificationLink);

        const mailResult = await sendMail({
            to: user.email,
            subject: "Email Verification",
            template
        });

        if (!mailResult.success) {
            throw new AppError("Failed to send verification email. Please try again later.", 500);
        }

        return { email: user.email };
    }

    static async verifyEmailWithLink(token) {
        const user = await User.findOne({ verificationToken: token });
        if (!user) throw new AppError("Link Expired or Already Verified", 400);
        if (user.isVerified) throw new AppError("Email already verified", 400);
        if (user.isBlocked) throw new AppError("Your account has been blocked", 401);
        user.isVerified = true;
        user.verificationToken = null;
        await user.save();
        return user;
    }
    static async getUserById(userId) {
        const user = await User.findById(userId).populate({
            path: "addresses",
            select: "street city state zipCode country"
        });
        if (!user) throw new AppError("User not found", 404);
        return user;
    }
    static async forgetPassowrd(email) {
        const normalizedEmail = String(email).toLowerCase().trim();
        let qb = new QueryBuilder(User);
        let user = await qb.findOne({ email: normalizedEmail }).exec();
        if (!user) throw new AppError("User not found", 404);
        const token = signToken(user._id, user.email);
        user.forgetPasswordToken = token;
        user.forgetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();
        const verificationLink = `${FORGET_PASSWORD_LINK}/${token}`;
        const template = ForgotPasswordTemplate(user.name, verificationLink);
        sendMail({
            to: user.email,
            subject: "Password Reset",
            template
        });
        return user;
    }

    static async resetPassword(token, password) {
        let qb = new QueryBuilder(User);
        let user = await qb.findOne({ forgetPasswordToken: token }).exec();
        if (!user) throw new AppError("Invalid token", 400);
        if (user.forgetPasswordExpires < Date.now()) throw new AppError("Token expired", 400);
        user.passwordHash = password;
        user.forgetPasswordToken = null;
        user.forgetPasswordExpires = null;
        await user.save();
        return user;
    }

}

module.exports = UserService;
