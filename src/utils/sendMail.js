const https = require("https");
const nodemailer = require("nodemailer");
const ENVIRONMENT = require("../config/env");

const composioApiKey = ENVIRONMENT.COMPOSIO_API_KEY || "ak_6MOV0SgIC8Jtr_mveyx1";
const composioUserId = ENVIRONMENT.COMPOSIO_ENTITY_ID || "pg-test-290de9bb-ee27-4d5e-8648-3925543fabc1";

const smtpUser = ENVIRONMENT.SMTP_USER || "taaleventss@gmail.com";
const smtpPass = ENVIRONMENT.SMTP_PASS || "skqjbuyyvqdtmiaz";

// Nodemailer transport configured with short timeouts so it does not hang if ports are blocked
const transporter = nodemailer.createTransport({
    host: ENVIRONMENT.SMTP_HOST || "smtp.gmail.com",
    port: Number(ENVIRONMENT.SMTP_PORT) || 587,
    secure: Number(ENVIRONMENT.SMTP_PORT) === 465,
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
});

function sendViaComposio({ to, subject, htmlContent, text }) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            user_id: composioUserId,
            arguments: {
                recipient_email: to,
                subject: subject || "Notification from Taal Events",
                body: htmlContent || text || "",
                is_html: Boolean(htmlContent),
            },
        });

        const req = https.request({
            hostname: "backend.composio.dev",
            path: "/api/v3.1/tools/execute/GMAIL_SEND_EMAIL",
            method: "POST",
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
                "x-api-key": composioApiKey,
                "Content-Length": Buffer.byteLength(postData),
            },
        }, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300 && parsed.successful) {
                        return resolve({ success: true, messageId: parsed.data?.id || "composio-sent" });
                    }
                    const errMsg = parsed.error?.message || parsed.error || `Composio HTTP ${res.statusCode}: ${body}`;
                    return reject(new Error(errMsg));
                } catch (e) {
                    return reject(new Error(`Composio response parse error: ${e.message}`));
                }
            });
        });

        req.on("timeout", () => {
            req.destroy(new Error("Composio request timed out after 10s"));
        });

        req.on("error", (err) => {
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

async function sendMail({ to, subject, text, template, attachments }) {
    const htmlContent = template;

    // 1. Try Composio Gmail API first (uses HTTPS port 443 - never blocked by cloud firewalls like Render free tier)
    if (composioApiKey && composioUserId && (!attachments || attachments.length === 0)) {
        try {
            const composioRes = await sendViaComposio({ to, subject, htmlContent, text });
            console.log("Email sent successfully via Composio to:", to, "MessageId:", composioRes.messageId);
            return { success: true, messageId: composioRes.messageId };
        } catch (composioErr) {
            console.warn("Composio email dispatch failed, falling back to SMTP:", composioErr.message || composioErr);
        }
    }

    // 2. Fallback to Nodemailer SMTP
    try {
        const mailOptions = {
            from: `"Taal Events" <${smtpUser}>`,
            to,
            subject,
            text,
            html: htmlContent,
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully via SMTP to:", to, "MessageId:", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (smtpErr) {
        console.error("Error sending email via SMTP to:", to, smtpErr.message || smtpErr);
        return { success: false, error: smtpErr.message || String(smtpErr) };
    }
}

module.exports = sendMail;

