/**
 * One-time script: Upload sample image to Cloudinary and
 * assign it to all product variants that have no images.
 *
 * Usage:  node scripts/add-sample-images.js
 * Run from ticket-booking-backend/ root.
 */

const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");

const envFile = ".env.development";
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config();
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ProductSale = require("../src/models/ProductSale");

const SAMPLE_IMAGE_PATH = path.resolve(
  __dirname,
  "../uploads/productImages/sample-product.png"
);

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  console.log("Uploading sample image to Cloudinary...");
  const result = await cloudinary.uploader.upload(SAMPLE_IMAGE_PATH, {
    folder: process.env.CLOUDINARY_FOLDER || "tickets",
    resource_type: "image",
  });
  const imageUrl = result.secure_url;
  console.log("Uploaded:", imageUrl);

  const products = await ProductSale.find({});
  console.log(`Found ${products.length} products.`);

  let updated = 0;
  for (const product of products) {
    let changed = false;
    for (const variant of product.variants) {
      if (!variant.images || variant.images.length === 0) {
        variant.images = [imageUrl];
        changed = true;
      }
    }
    if (changed) {
      await product.save();
      updated++;
      console.log(`  Updated: ${product.title} (${product.variants.length} variants)`);
    }
  }

  console.log(`\nDone. Updated ${updated} products with sample image.`);
  console.log("Image URL:", imageUrl);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
