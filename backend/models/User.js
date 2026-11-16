const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const geoJsonPointSchema = require('../utils/geoJsonPointSchema');

const userRoles = ['provider', 'ngo', 'volunteer', 'admin'];

const pickupCapacitySchema = new mongoose.Schema(
  {
    unit: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    maxQuantity: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return Number.isFinite(value) && value > 0;
        },
        message: 'Pickup capacity must be a positive finite number.',
      },
    },
  },
  { _id: false },
);

function containsPasswordField(value) {
  if (Array.isArray(value)) {
    return value.some(containsPasswordField);
  }

  if (value === null || typeof value !== 'object') {
    return false;
  }

  return Object.entries(value).some(([key, nestedValue]) => {
    if (key === 'password' || key.endsWith('.password')) {
      return true;
    }

    if (
      key === '$rename' &&
      nestedValue &&
      typeof nestedValue === 'object' &&
      Object.values(nestedValue).some((target) => target === 'password')
    ) {
      return true;
    }

    return containsPasswordField(nestedValue);
  });
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address.'],
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 8,
      validate: {
        validator(value) {
          return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72;
        },
        message: 'Password cannot exceed 72 UTF-8 bytes.',
      },
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: userRoles,
      required: true,
    },
    organizationName: {
      type: String,
      trim: true,
    },
    acceptedFoodCategories: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [],
    },
    pickupCapacity: {
      type: [pickupCapacitySchema],
      default: [],
      validate: {
        validator(capacities) {
          const units = capacities.map((capacity) =>
            typeof capacity.unit === 'string' ? capacity.unit.toLowerCase() : '',
          );
          return units.length === new Set(units).size;
        },
        message: 'Pickup capacity can only contain one entry per unit.',
      },
    },
    address: {
      type: String,
      trim: true,
    },
    location: {
      type: geoJsonPointSchema,
      default: undefined,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'not_required'],
      default() {
        return ['provider', 'ngo'].includes(this.role) ? 'pending' : 'not_required';
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(document, result) {
        delete result.password;
        delete result.__v;
        return result;
      },
    },
  },
);

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

userSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'],
  function rejectPasswordQueryUpdates() {
    if (containsPasswordField(this.getUpdate())) {
      throw new Error('Password updates must use document.save() so hashing is applied.');
    }
  },
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ role: 1, isActive: 1, isVerified: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
