// class QueryBuilder {
//     constructor(model, includeDeleted = false) {
//         this.model = model;
//         this.query = null;
//         this.includeDeleted = includeDeleted;
//         this.filterConditions = {}; // countDocuments ke liye store karenge
//     }

//     // ---------- READ ----------
//     filter(fields = {}) {
//         // Deleted ko handle karo
//         this.filterConditions = this.includeDeleted ? fields : { isDeleted: false, ...fields };
//         this.query = this.model.find(this.filterConditions);
//         return this;
//     }

//     populate(path, select = "") {
//         this.query = this.query.populate(path, select);
//         return this;
//     }

//     findOne(fields = {}) {
//         this.filterConditions = this.includeDeleted ? fields : { isDeleted: false, ...fields };
//         console.log(this.filterConditions, "this.filterConditions");
//         this.query = this.model.findOne(this.filterConditions);
//         return this;
//     }

//     select(fields = "") {
//         this.query = this.query.select(fields);
//         return this;
//     }

//     sort(sortBy = "") {
//         this.query = this.query.sort(sortBy);
//         return this;
//     }

//     search(searchText = "", keys = []) {
//         if (!searchText || !Array.isArray(keys) || keys.length === 0) return this;

//         const searchRegex = new RegExp(searchText, "i");

//         const searchConditions = {
//             $or: keys.map(key => ({ [key]: searchRegex }))
//         };
//         // Merge existing filter conditions with search conditions using $and
//         const finalConditions = {
//             $and: [this.filterConditions, searchConditions]
//         };
//         this.query = this.model.find(finalConditions);
//         return this;
//     }

//     paginate(page = 1, limit = 10) {
//         const skip = (page - 1) * limit;
//         this.query = this.query.skip(skip).limit(limit);
//         return this;
//     }

//     aggregate(pipeline = []) {
//         this.query = this.model.aggregate(pipeline);
//         return this;
//     }

//     // ---------- COUNT ----------
//     async count() {
//         return await this.model.countDocuments(this.filterConditions);
//     }

//     // ---------- CREATE ----------
//     create(data) {
//         this.query = this.model.create(data);
//         return this;
//     }

//     // ---------- UPDATE ----------
//     update(filter, updateData, options = { new: true }) {
//         this.query = this.model.findOneAndUpdate(filter, updateData, options);
//         return this;
//     }

//     // ---------- DELETE ----------
//     delete(filter) {
//         this.query = this.model.findOneAndUpdate(filter, { isDeleted: true, deletedAt: new Date() }, { new: true });
//         return this;
//     }

//     // ---------- SESSION ----------
//     session(session) {
//         this.query = this.query.session(session);
//         return this;
//     }

//     // ---------- EXECUTE ----------
//     async exec() {
//         return await this.query;
//     }
// }

// module.exports = QueryBuilder;


// services/queryBuilder.js
class QueryBuilder {
    constructor(model, includeDeleted = false) {
        this.model = model;
        this.includeDeleted = includeDeleted;
        this.filterConditions = {};
        this.query = null;
        this._page = 1;
        this._limit = 10;
    }

    // ---------- READ ----------
    filter(fields = {}) {
        this.filterConditions = this.includeDeleted ? { ...fields } : { isDeleted: false, ...fields };
        this.query = this.model.find(this.filterConditions);
        return this;
    }

    findOne(fields = {}) {
        this.filterConditions = this.includeDeleted ? { ...fields } : { isDeleted: false, ...fields };
        this.query = this.model.findOne(this.filterConditions);
        return this;
    }

    populate(path, select = "") {
        if (!this.query) this.query = this.model.find(this.filterConditions);
        this.query = this.query.populate(path, select);
        return this;
    }

    select(fields = "") {
        if (!this.query) this.query = this.model.find(this.filterConditions);
        this.query = this.query.select(fields);
        return this;
    }

    sort(sortBy = { createdAt: -1 }) {
        if (!this.query) this.query = this.model.find(this.filterConditions);
        this.query = this.query.sort(sortBy);
        return this;
    }

    search(searchText = "", keys = []) {
        if (!searchText || !Array.isArray(keys) || keys.length === 0) return this;
        const searchRegex = new RegExp(searchText, "i");
        const searchConditions = { $or: keys.map(key => ({ [key]: searchRegex })) };

        this.filterConditions = { $and: [this.filterConditions, searchConditions] };
        this.query = this.model.find(this.filterConditions);
        return this;
    }

    rangeFilter(field, min = null, max = null) {
        if (min != null || max != null) {
            this.filterConditions[field] = {};
            if (min != null) this.filterConditions[field].$gte = Number(min);
            if (max != null) this.filterConditions[field].$lte = Number(max);
        }
        this.query = this.model.find(this.filterConditions);
        return this;
    }

    paginate(page = 1, limit = 10) {
        const p = Math.max(parseInt(page, 10) || 1, 1);
        const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
        this._page = p;
        this._limit = l;
        const skip = (p - 1) * l;

        if (!this.query) this.query = this.model.find(this.filterConditions);
        this.query = this.query.skip(skip).limit(l);
        return this;
    }

    aggregate(pipeline = []) {
        this.query = this.model.aggregate(pipeline);
        return this;
    }

    // ---------- COUNT ----------
    async count() {
        return await this.model.countDocuments(this.filterConditions);
    }

    // ---------- CREATE ----------
    create(data) {
        this.query = this.model.create(data);
        return this;
    }

    // ---------- UPDATE ----------
    update(filter, updateData, options = { new: true }) {
        const f = this.includeDeleted ? filter : { isDeleted: false, ...filter };
        this.query = this.model.findOneAndUpdate(f, updateData, options);
        return this;
    }

    // ---------- DELETE (soft) ----------
    delete(filter) {
        const f = this.includeDeleted ? filter : { isDeleted: false, ...filter };
        this.query = this.model.findOneAndUpdate(f, { isDeleted: true, deletedAt: new Date() }, { new: true });
        return this;
    }

    // ---------- LEAN ----------
    lean() {
        if (this.query && typeof this.query.lean === "function") {
            this.query = this.query.lean();
        }
        return this;
    }

    session(session) {
        if (this.query && typeof this.query.session === "function") {
            this.query = this.query.session(session);
        }
        return this;
    }

    async exec() {
        return await this.query;
    }
}

module.exports = QueryBuilder;


