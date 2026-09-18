// controllers/address.controller.js
const mongoose = require("mongoose");
const User = require("../../models/User");
const Address = require("../../models/Address");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/AppError");
const { successRes } = require("../../utils/responseFormatter");
const QueryBuilder = require("../../services/queryBuilder");

const PINCODE_REGEX = /^\d{6}$/;
const MAX_ADDRESSES = parseInt(process.env.MAX_ADDRESSES_PER_USER, 10) || 20;

// ---------- CREATE ----------
exports.createAddress = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    if (!mongoose.isValidObjectId(userId)) {
        return next(new AppError("Invalid UserId", 400))
    }
    const { fullName, phone, label, line1, line2, city, state, pincode, country, isDefault, lat, lng } = req.body;

    if (!line1 || !city || !state || !pincode) {
        return next(new AppError("line1, city, state and pincode are required", 400));
    }

    if (!PINCODE_REGEX.test(String(pincode))) {
        return next(new AppError("Invalid pincode format", 400));
    }

    // limit check
    const existingCount = await Address.countDocuments({ user: userId, isDeleted: false });
    if (existingCount >= MAX_ADDRESSES) {
        return next(new AppError(`Maximum ${MAX_ADDRESSES} addresses allowed`, 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (isDefault) {
            console.log(isDefault, "isDefault")
            let updatedAddress = await Address.updateMany(
                { user: userId, isDefault: true, isDeleted: { $ne: true } },
                { $set: { isDefault: false } },
                { session }
            );
        }

        const [address] = await Address.create([{
            user: userId,
            fullName,
            phone,
            label,
            line1,
            line2,
            city,
            state,
            pincode,
            country: country || 'India',
            lat,
            lng,
            isDefault: !!isDefault
        }], { session });

        // ensure user's addresses array remains consistent
        await User.findByIdAndUpdate(userId, { $addToSet: { addresses: address._id } }, { session });

        await session.commitTransaction();
        session.endSession();

        return successRes(res, 201, true, "Address created successfully", address);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});


// ---------- GET ALL ----------
exports.getAllAddresses = catchAsync(async (req, res, next) => {
    const userId = req.userId;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const search = req.query.search || "";

    const qb = new QueryBuilder(Address);
    qb.filter({ user: userId })
        .search(search, ["fullName", "phone", "label", "line1", "line2", "city", "state", "pincode"])
        .sort({ createdAt: -1 })
        .paginate(page, limit);

    const [addresses, total] = await Promise.all([
        qb.exec(),
        qb.count()
    ]);

    return successRes(res, 200, true, "Addresses fetched successfully", {
        addresses,
        meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) }
    });
});


// ---------- GET BY ID ----------
exports.getAddressById = catchAsync(async (req, res, next) => {
    const { addressId } = req.query;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return next(new AppError("Invalid address id", 400));
    }

    const qb = new QueryBuilder(Address);
    const address = await qb.findOne({ _id: addressId, user: userId }).exec();

    if (!address) {
        return next(new AppError("Address not found", 404));
    }

    return successRes(res, 200, true, "Address fetched successfully", address);
});


// ---------- UPDATE ----------
exports.updateAddress = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    if (!mongoose.isValidObjectId(userId)) {
        return next(new AppError("Invalid UserId", 400))
    }
    const { fullName, phone, addressId, label, line1, line2, city, state, pincode, country, isDefault, lat, lng } = req.body;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return next(new AppError("Invalid address id", 400));
    }

    if (pincode !== undefined && !PINCODE_REGEX.test(String(pincode))) {
        return next(new AppError("Invalid pincode format", 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 🔎 Step 1: find the address using QueryBuilder
        let qb = new QueryBuilder(Address);
        const address = await qb.findOne({ _id: addressId, user: userId }).session(session).exec();

        if (!address) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError("Address not found", 404));
        }

        // 🔄 Step 2: handle default logic
        if (isDefault) {
            await Address.updateMany(
                { user: userId, isDefault: true, isDeleted: { $ne: true }, _id: { $ne: addressId } },
                { $set: { isDefault: false } },
                { session }
            );
        }

        // 🔨 Step 3: update fields via QueryBuilder.update()
        const updateData = {
            fullName: fullName ?? address.fullName,
            phone: phone ?? address.phone,
            label: label ?? address.label,
            line1: line1 ?? address.line1,
            line2: line2 ?? address.line2,
            city: city ?? address.city,
            state: state ?? address.state,
            pincode: pincode ?? address.pincode,
            country: country ?? address.country,
            lat: lat ?? address.lat,
            lng: lng ?? address.lng,
            isDefault: isDefault !== undefined ? isDefault : address.isDefault
        };

        let qbUpdate = new QueryBuilder(Address);
        const updatedAddress = await qbUpdate
            .update({ _id: addressId, user: userId }, updateData, { new: true })
            .session(session)
            .exec();

        await session.commitTransaction();
        session.endSession();

        return successRes(res, 200, true, "Address updated successfully", updatedAddress);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});

// ---------- DELETE (soft) ----------
exports.deleteAddress = catchAsync(async (req, res, next) => {
    const { addressId } = req.query;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return next(new AppError("Invalid address id", 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const qb = new QueryBuilder(Address);

        // Soft delete (qb.delete use karke)
        const address = await qb.delete({ _id: addressId, user: userId }).exec();

        if (!address) {
            await session.abortTransaction();
            session.endSession();
            return next(new AppError("Address not found", 404));
        }

        const wasDefault = !!address.isDefault;

        // ✅ Yaha update() ka use karna hai
        const userQB = new QueryBuilder(User);
        await userQB.update(
            { _id: userId }, // filter
            { $pull: { addresses: address._id } }, // update data
            { session } // options
        ).exec();

        // Agar deleted address default tha → replacement choose karo
        if (wasDefault) {
            const replacementQB = new QueryBuilder(Address);
            const replacement = await replacementQB.findOne({
                user: userId,
                isDeleted: false
            }).sort({ createdAt: -1 }).session(session).exec();

            if (replacement) {
                replacement.isDefault = true;
                await replacement.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        return successRes(res, 200, true, "Address deleted successfully");
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});

