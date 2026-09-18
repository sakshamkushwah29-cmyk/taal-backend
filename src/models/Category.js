const { Schema, model } = require("mongoose");
const softDeletePlugin = require("../utils/softDelete");
const capitalizeWords = require("../utils/helper").capitalizeWords;

const CategorySchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String }, // optional detail
        icon: { type: String }, // optional - category icon/image
        parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

CategorySchema.pre("save", function (next) {
    if (this.name) {
        this.name = capitalizeWords(this.name);
    }
    if (this.description) {
        this.description = capitalizeWords(this.description);
    }
    next();
});
softDeletePlugin(CategorySchema);
CategorySchema.index({ name: 1 });

module.exports = model("Category", CategorySchema);
