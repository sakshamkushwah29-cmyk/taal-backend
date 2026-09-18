
// src/services/userService.js
const { EMAIL_VERIFICATION_LINK, FORGET_PASSWORD_LINK } = require("../config/env");
const { ForgotPasswordTemplate } = require("../emailTemplates/forgetPasswordTemplate");
const { EmailVerificationTemplate } = require("../emailTemplates/userVerificationTemplate");
const welcomeEventManager = require("../emailTemplates/welcomeEventManager");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/jwt");
const sendMail = require("../utils/sendMail");
const QueryBuilder = require("./queryBuilder");


class SuperAdminServices {

    //gatekeeper management
    static async createGatekeeper({ name, email, phone, password, creatorId }) {
        let qb = new QueryBuilder(User);
        let existingUser = await qb.findOne({ email }).exec();
        if (existingUser) {
            throw new AppError("User with this email already exists", 400);
        }
        const user = await new QueryBuilder(User)
            .create({
                name,
                email,
                phone,
                passwordHash: password,
                role: "gatekeeper",
                isVerified: true,
                createdBy: creatorId
            })
            .exec();

        //send welcome mail
        let template = welcomeEventManager({ name, email, password, role: "gatekeeper" });
        sendMail({
            to: email,
            subject: "Welcome to the Event Management Team 🎉",
            template: template
        });
        return user;

    }

}

module.exports = SuperAdminServices;
