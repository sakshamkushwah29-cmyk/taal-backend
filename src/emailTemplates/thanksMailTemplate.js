module.exports.thanksMailToUser = ({ name, eventName, eventDate, eventTime, venue, ticketIds }) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Thank You for Booking</title>
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
            .ticket-details {
                background: #f1f3f5;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                font-family: monospace;
            }
            .ticket-details p {
                margin: 5px 0;
            }
            .btn {
                display: inline-block;
                background: #28a745;
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
            <h2>Thank You for Booking! 🎉</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>We’re thrilled that you’ve booked your tickets for <strong>${eventName}</strong>. Here are your ticket IDs:</p>
            
            <div class="ticket-details">
                ${ticketIds.map(id => `<p>🎫 ${id}</p>`).join("")}
            </div>

            <p>Event Details:</p>
            <div class="ticket-details">
                <p><strong>Date:</strong> ${eventDate.toString().split("T")[0]}</p>
                <p><strong>Time:</strong> 7:00 PM Onwards</p>
                <p><strong>Venue:</strong> ${venue}</p>
            </div>

            <p>Keep these ticket IDs handy to ensure smooth entry at the event.</p>

            <p class="footer">
                If you have any questions, feel free to contact our support team.
                <br>© ${new Date().getFullYear()} Your Company. All rights reserved.
            </p>
        </div>
    </body>
    </html>
    `;
};
