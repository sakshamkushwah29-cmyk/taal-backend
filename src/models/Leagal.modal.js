const mongoose = require('mongoose');

const legalSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["privacy_policy", "terms_conditions"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String, // यहाँ पूरा document का HTML / text content रहेगा
      required: true,
    },
    version: {
      type: String,
      default: "1.0", // हर बार update पर version बढ़ा सकते हो
    },
    isActive: {
      type: Boolean,
      default: true, // सिर्फ active वाला ही frontend पर दिखे
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LegalDocument", legalSchema);
