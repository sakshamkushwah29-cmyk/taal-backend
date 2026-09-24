const nodemailer = require("nodemailer");
const ENVIRONMENT = require("../config/env");

const smtpUser = ENVIRONMENT.SMTP_USER || "taaleventss@gmail.com";
const smtpPass = ENVIRONMENT.SMTP_PASS || "skqjbuyyvqdtmiaz";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
});

async function sendMail({ to, subject, text, template, attachments }) {
    try {
        const htmlContent = template;

        const mailOptions = {
            from: `"Taal Events" <${smtpUser}>`,
            to,
            subject,
            text,
            html: htmlContent,
            attachments, // optional: for PDFs, images, etc.
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully to:", to, "MessageId:", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email to:", to, error.message || error);
        return { success: false, error: error.message || error };
    }
}

module.exports = sendMail;

