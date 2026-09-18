module.exports.successRes = (res, status, success, message, data) => {
    return res.status(status).json({
        success: success,
        status: status,
        message: message,
        data: data ? data : null
    })
}

module.exports.errorRes = (res, status, success, message, data) => {
    return res.status(status).json({
        success: success,
        status: status,
        message: message,
        data: data ? data : null
    })
}
