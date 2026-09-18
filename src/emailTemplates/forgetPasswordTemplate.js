module.exports.ForgotPasswordTemplate = (userName, resetLink, options = {}) => {
    const {
        appName = "Taal.life",
        primaryColor = "#ff5722", // TAL.Live ka highlight color
        secondaryColor = "#fff5f0",
        footerText = `© ${new Date().getFullYear()} ${appName}. All rights reserved.`
    } = options;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Password Reset</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, sans-serif;
                background-color: ${secondaryColor};
                padding: 30px;
                text-align: center;
            }
            .container {
                background-color: #ffffff;
                padding: 25px;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: auto;
                border: 2px solid ${primaryColor};
            }
            .title {
                color: ${primaryColor};
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 10px;
            }
            .content {
                font-size: 16px;
                color: #444;
                margin: 20px 0;
                line-height: 1.6;
            }
            .button {
                display: inline-block;
                background-color: ${primaryColor};
                color: white;
                padding: 12px 25px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 6px;
                text-decoration: none;
                transition: 0.3s ease;
            }
            .button:hover {
                background-color: #e64a19;
            }
            .footer {
                font-size: 12px;
                color: #888;
                margin-top: 30px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="title">Reset Your Password</h1>
            <p class="content">
                Hi <strong>${userName}</strong>,<br/>
                We received a request to reset your password for your <strong>${appName}</strong> account.<br/>
                Click the button below to set a new password.
            </p>
            <a href="${resetLink}" class="button" target="_blank">Reset Password</a>
            <p class="content" style="font-size: 14px; color: #999;">
                If you didn't request this, you can safely ignore this email.
            </p>
            <div class="footer">
                ${footerText}
            </div>
        </div>
    </body>
    </html>
    `;
};
