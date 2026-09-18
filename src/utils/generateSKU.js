// utils/generateSKU.js
const crypto = require("crypto");

function generateSKU(title) {
    if (!title) return "SKU-" + Date.now();

    // 1. Title ko clean karna
    const cleaned = title
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") // sirf alphabets aur numbers
        .slice(0, 6); // first 6 chars tak limit

    // 2. Random short code add karna
    const random = crypto.randomBytes(2).toString("hex").toUpperCase(); // 4 digit hex

    return `${cleaned}-${random}`;
}

module.exports = generateSKU;
