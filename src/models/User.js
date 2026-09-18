// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator'); // for email, phone validations
const { Schema } = mongoose;
const softDelete = require('../utils/softDelete');

const UserSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name must be less than 50 characters']
    },
    email: {
        type: String,
        index: true,
        sparse: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                return !v || validator.isEmail(v); // allow null but validate format if present
            },
            message: 'Invalid email format'
        }
    },
    phone: {
        type: String,
        index: true,
        sparse: true,
        trim: true,
        validate: {
            validator: function (v) {
                return !v || validator.isMobilePhone(v, 'any'); // allow null but validate if present
            },
            message: 'Invalid phone number format'
        }
    },
    passwordHash: {
        type: String,
        minlength: [6, 'Password must be at least 6 characters long'], // check before hashing
        select: false // do not return in queries by default
    },
    role: {
        type: String,
        enum: ['user', 'superadmin', 'event_manager', 'gatekeeper'],
        default: 'user'
    },
    permissions: {
        type: [String], // e.g. ["event:view", "ticket:create"]
        default: []
    },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    verificationType: {
        type: String,
        enum: ['email', 'phone', null],
        default: null
    },
    verificationToken: String,
    verificationExpires: Date,
    forgetPasswordToken: String,
    forgetPasswordExpires: Date,
    profilePic: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                return !v || validator.isURL(v);
            },
            message: 'Invalid profile picture URL'
        }
    },
    addresses: [{ type: Schema.Types.ObjectId, ref: 'Address' }],
    signupMethod: {
        type: String,
        enum: ['email', 'google'],
        default: 'email'
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ✅ Hash password before save
UserSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    if (this.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
    next();
});

// ✅ Compare password method
UserSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHash);
};

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp; // true => password changed after token issued
    }
    return false;
};

softDelete(UserSchema);
module.exports = mongoose.model('User', UserSchema);
