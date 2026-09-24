const dotenv = require("dotenv");
const fs = require("fs");

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";

if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
} else if (fs.existsSync(".env.local")) {
    dotenv.config({ path: ".env.local" });
} else {
    dotenv.config();
}

const ENVIRONMENT = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    PORT: process.env.PORT || 8080,
    MONGO_URI: process.env.MONGO_URI,
    FRONTEND_URL: process.env.FRONTEND_URL,
    EMAIL_VERIFICATION_LINK: `${process.env.FRONTEND_URL}/email-verification`,
    FORGET_PASSWORD_LINK: `${process.env.FRONTEND_URL}/reset-password`,
    IMAGE_FILE_PATH: process.env.FILE_URL,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_live_RJ78sILs64v88G",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "lKEjpXVwhpe1FGEHQ2SD15ys",
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
    SMTP_PORT: process.env.SMTP_PORT || 587,
    SMTP_USER: process.env.SMTP_USER || "taaleventss@gmail.com",
    SMTP_PASS: process.env.SMTP_PASS || "skqjbuyyvqdtmiaz",
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "dhcjqoy1y",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "471446417654999",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "AycMCj-j56of1NOSgjU_siquAw8",
    CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || "tickets",
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY || "ak_6MOV0SgIC8Jtr_mveyx1",
    COMPOSIO_ENTITY_ID: process.env.COMPOSIO_ENTITY_ID || "pg-test-290de9bb-ee27-4d5e-8648-3925543fabc1",
};

module.exports = ENVIRONMENT;
