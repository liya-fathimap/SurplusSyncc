const mongoose = require('mongoose');

const reservationStatuses = [
  'pending',
  'confirmed',
  'rejected',
  'cancelled',
  'completed',
  'failed',
];
const collectionMethods = ['self_pickup', 'volunteer_delivery'];

const reservationSchema = new mongoose.Schema(
  {
    foodListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodListing',
      required: true,
    },
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return Number.isFinite(value) && value > 0;
        },
        message: 'Requested quantity must be a positive finite number.',
      },
    },
    approvedQuantity: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator(value) {
          return (
            value === null ||
            (Number.isFinite(value) &&
              Number.isFinite(this.requestedQuantity) &&
              value <= this.requestedQuantity)
          );
        },
        message: 'Approved quantity cannot exceed the requested quantity.',
      },
    },
    status: {
      type: String,
      enum: reservationStatuses,
      default: 'pending',
      required: true,
    },
    collectionMethod: {
      type: String,
      enum: collectionMethods,
      required: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'requestedAt', updatedAt: 'updatedAt' },
  },
);

reservationSchema.pre('validate', function validateApprovalState() {
  if (
    this.status === 'confirmed' ||
    this.status === 'completed' ||
    this.status === 'failed'
  ) {
    if (!(this.approvedQuantity > 0)) {
      this.invalidate('approvedQuantity', 'Confirmed reservations require an approved quantity.');
    }
    if (!this.confirmedAt) {
      this.invalidate('confirmedAt', 'Confirmed reservations require a confirmation time.');
    }
  } else if (
    (this.status === 'pending' || this.status === 'rejected') &&
    this.approvedQuantity !== null &&
    this.approvedQuantity !== 0
  ) {
    this.invalidate('approvedQuantity', 'Pending or rejected reservations cannot reserve stock.');
  }
});

reservationSchema.index({ foodListing: 1, status: 1 });
reservationSchema.index({ ngo: 1, status: 1, requestedAt: -1 });

module.exports =
  mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);
