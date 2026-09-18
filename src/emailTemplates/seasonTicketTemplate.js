module.exports.seasonTiecketTemplate = ({ name, date, ticketId, qrCode }) => {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Event Pass</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Montserrat', sans-serif;
        background-color: #000;
      }
    </style>
  </head>
  <body>
    <div class="relative inline-block">
      <!-- Ticket image -->
      <div class="relative inline-block w-[800px] h-auto">
  <img
    src="https://backend.taal.life/uploads/productImages/1758316419547-559714911.png"
    alt="Event Pass"
    class="w-full h-full object-contain block bg-transparent"
/>
</div>
  
      <!-- Name -->
      <div class="absolute top-[67%] left-9 flex flex-col space-y-2 text-white">
        <span class="text-3xl font-semibold uppercase">${name}</span>
      </div>
  
      <!-- Date -->
      <div class="absolute top-[76%] left-9 flex flex-col space-y-2 text-white">
        <span class="text-3xl font-semibold uppercase">${date}</span>
      </div>
  
      <!-- QR Code -->
      <div class="absolute top-[70%] right-6 flex items-center justify-center">
        <img src="${qrCode}" alt="QR Code" class="w-72 h-72 object-contain bg-white" />
      </div>
  
      <!-- Ticket ID -->
    <div class="absolute bottom-6 right-14 flex flex-col space-y-2 text-white">
  <span class="text-2xl font-semibold">${ticketId}</span>
</div>
    </div>
  </body>
  </html>`;
};