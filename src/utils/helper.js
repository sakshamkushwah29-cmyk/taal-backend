function generateTicketId(eventCode) {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `${eventCode.toUpperCase()}-${year}-${randomNum}`;
}

function formatTime24to12(time24) {
    if (!time24) return "";
    const [hourStr, minute] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
}

function capitalizeWords(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}


module.exports = { generateTicketId, formatTime24to12, capitalizeWords };