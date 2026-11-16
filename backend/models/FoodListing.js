const mongoose = require('mongoose');
const geoJsonPointSchema = require('../utils/geoJsonPointSchema');

const listingStatuses = [
  'draft',
  'available',
  'partially_reserved',
  'fully_reserved',
  'expired',
  'cancelled',
];

const foodListingSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    foodCategory: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return Number.isFinite(value) && value > 0;
        },
        message: 'Quantity must be a positive finite number.',
      },
    },
    availableQuantity: {
      type: Number,
      required: true,
      default() {
        return this.quantity;
      },
      min: 0,
      validate: {
        validator(value) {
          return (
            Number.isFinite(value) &&
            Number.isFinite(this.quantity) &&
            value <= this.quantity
          );
        },
        message: 'Available quantity must be between zero and the total quantity.',
      },
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    preparedAt: {
      type: Date,
      required: true,
    },
    collectionDeadline: {
      type: Date,
      required: true,
    },
    storageCondition: {
      type: String,
      required: true,
      trim: true,
    },
    allergens: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    image: {
      type: String,
      trim: true,
    },
    pickupAddress: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: geoJsonPointSchema,
      required: true,
    },
    status: {
      type: String,
      enum: listingStatuses,
      default: 'draft',
      required: true,
    },
  },
  { timestamps: true, optimisticConcurrency: true },
);

foodListingSchema.pre('validate', function validateInventoryState() {
  if (
    this.preparedAt &&
    this.collectionDeadline &&
    this.collectionDeadline <= this.preparedAt
  ) {
    this.invalidate('collectionDeadline', 'Collection deadline must be after preparation.');
  }

  if (this.status === 'available' && this.availableQuantity !== this.quantity) {
    this.invalidate('status', 'Available listings must have their full quantity available.');
  } else if (
    this.status === 'partially_reserved' &&
    !(this.availableQuantity > 0 && this.availableQuantity < this.quantity)
  ) {
    this.invalidate('status', 'Partially reserved listings must have some stock remaining.');
  } else if (this.status === 'fully_reserved' && this.availableQuantity !== 0) {
    this.invalidate('status', 'Fully reserved listings cannot have stock remaining.');
  }
});

foodListingSchema.index({ location: '2dsphere' });
foodListingSchema.index({ provider: 1, status: 1, createdAt: -1 });
foodListingSchema.index({ status: 1, collectionDeadline: 1 });

module.exports =
  mongoose.models.FoodListing || mongoose.model('FoodListing', foodListingSchema);
