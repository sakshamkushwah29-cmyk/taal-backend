module.exports = ({ name, email, password, role }) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Welcome to Our Platform</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f8f9fa;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: auto;
                background: #ffffff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0,0,0,0.05);
            }
            h2 {
                color: #2c3e50;
                text-align: center;
            }
            p {
                color: #555;
                font-size: 15px;
                line-height: 1.6;
            }
            .credentials {
                background: #f1f3f5;
                padding: 10px;
                border-radius: 5px;
                margin: 15px 0;
                font-family: monospace;
            }
            .btn {
                display: inline-block;
                background: #007bff;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
                font-size: 14px;
                margin-top: 10px;
            }
            .footer {
                font-size: 12px;
                text-align: center;
                color: #888;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Welcome to Our Event Management Team 🎉</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>We’re excited to have you on board as our new <strong>${role === 'event_manager' ? 'Event Manager' : 'Gatekeeper'}</strong>! Below are your login credentials:</p>
            
            <div class="credentials">
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong> ${password}</p>
            </div>

            <p>You can log in and start managing events right away:</p>
            <a class="btn" href="https://your-domain.com/login" target="_blank">Login to Dashboard</a>

            <p class="footer">
                If you did not request this account, please contact our support team immediately.
                <br>© ${new Date().getFullYear()} Your Company. All rights reserved.
            </p>
        </div>
    </body>
    </html>
    `;
};
