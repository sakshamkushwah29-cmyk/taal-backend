// Run every 15 minutes
const cron = require('node-cron');
const { cancelAndRestockExpiredOrders, cancelAndRestockExpiredRentals } = require('../helper/productHelper');


cron.schedule('*/1 * * * *', async () => {
    try {
        await cancelAndRestockExpiredOrders();
        await cancelAndRestockExpiredRentals();
        console.log('Expired orders and rentals processed successfully.');
    } catch (err) {
        console.error('Error processing expired bookings:', err);
    }

});