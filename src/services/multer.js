// utils/uploader.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { successRes } = require("../utils/responseFormatter");

// 🔹 Ensure or optionally clean upload folder
const prepareFolder = (folder, clean = false) => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    } else if (clean) {
        fs.readdirSync(folder).forEach((file) => {
            fs.unlinkSync(path.join(folder, file));
        });
    }
};

// 🔹 MIME → Extension map
const mimeToExt = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv",
    "application/json": "json",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
};

// 🔹 Factory to create multer instance
const createMulter = (options = {}) => {
    const {
        folder = "uploads/miscellaneous",
        fileSize = 10 * 1024 * 1024, // 10 MB
        fileTypes = /jpeg|jpg|png|pdf|doc|docx|txt|xls|xlsx|csv|json|zip|rar/,
        cleanFolder = false,
    } = options;

    prepareFolder(folder, cleanFolder);

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, folder),
        filename: (req, file, cb) => {
            const ext = mimeToExt[file.mimetype] || path.extname(file.originalname);
            const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
            cb(null, fileName);
        },
    });

    const fileFilter = (req, file, cb) => {
        if (!fileTypes.test(file.mimetype)) {
            return cb(
                new Error(`Only files of type ${fileTypes.toString()} are allowed`)
            );
        }
        cb(null, true);
    };

    return multer({
        storage,
        fileFilter,
        limits: { fileSize },
    });
};

// 🔹 Wrapper to simplify single/multiple/fields/any
const uploader = (mode, fieldName, options = {}, maxCountOrFields) => {
    const upload = createMulter(options);

    let middleware;
    if (mode === "single") {
        middleware = upload.single(fieldName);
    } else if (mode === "array") {
        middleware = upload.array(fieldName, maxCountOrFields || 5);
    } else if (mode === "fields") {
        middleware = upload.fields(maxCountOrFields || []);
    } else {
        middleware = upload.any();
    }

    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    if (err.code === "LIMIT_FILE_SIZE") {
                        return successRes(
                            res,
                            400,
                            false,
                            `File too large. Max size is ${options.fileSize / (1024 * 1024)} MB`
                        );
                    }
                    if (err.code === "LIMIT_UNEXPECTED_FILE") {
                        return successRes(res, 400, false, "Unexpected file uploaded.");
                    }
                    return successRes(res, 400, false, err.message);
                }
                return successRes(res, 400, false, err.message);
            }
            next();
        });
    };
};

// 🔹 Centralized exports
module.exports = {
    // generic
    uploader,

    // pre-configured shortcuts
    uploadBannerImage: uploader("single", "image", {
        folder: "uploads/eventBanners",
        fileTypes: /jpeg|jpg|png/,
    }),

    uploadEventImages: uploader("array", "images", {
        folder: "uploads/eventImages",
        fileTypes: /jpeg|jpg|png/,
    }, 5),

    uploadUserProfile: uploader("single", "image", {
        folder: "uploads/userAvatar",
        fileTypes: /jpeg|jpg|png/,
    }),

    uploadProductImage: uploader("array", "images", {
        folder: "uploads/productImages",
        fileTypes: /jpeg|jpg|png/,
    }, 5),
};
