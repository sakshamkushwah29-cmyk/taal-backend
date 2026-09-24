const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const ENVIRONMENT = require("../config/env");

cloudinary.config({
    cloud_name: ENVIRONMENT.CLOUDINARY_CLOUD_NAME || "dhcjqoy1y",
    api_key: ENVIRONMENT.CLOUDINARY_API_KEY || "471446417654999",
    api_secret: ENVIRONMENT.CLOUDINARY_API_SECRET || "AycMCj-j56of1NOSgjU_siquAw8",
});

/**
 * Upload a local file to Cloudinary and return its secure URL.
 * Automatically cleans up the local temporary file if deleteLocal is true.
 */
async function uploadToCloudinary(filePath, folder = "taal_uploads", deleteLocal = true) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: "auto",
        });
        if (deleteLocal && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                console.warn("Could not delete local file:", filePath, e.message);
            }
        }
        return result.secure_url;
    } catch (error) {
        console.error("Cloudinary upload failed for:", filePath, error);
        throw error;
    }
}

module.exports = {
    cloudinary,
    uploadToCloudinary,
};
