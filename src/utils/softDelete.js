// utils/softDelete.js
const softDeletePlugin = (schema, options = {}) => {
    schema.add({
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null }
    });

    schema.methods.softDelete = function () {
        this.isDeleted = true;
        this.deletedAt = new Date();
        return this.save();
    };
};

module.exports = softDeletePlugin;
