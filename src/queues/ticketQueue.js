const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis();
const ticketQueue = new Queue('ticket-generation', { connection });

module.exports = { ticketQueue, connection };