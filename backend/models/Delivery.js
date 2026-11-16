const mongoose = require('mongoose');

const deliveryStatuses = [
  'pending',
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
  'cancelled',
];
const sha256DigestPattern = /^[a-f\d]{64}$/i;
const volunteerRequiredStatuses = [
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
];
const pickupTimeRequiredStatuses = ['picked_up', 'in_transit', 'delivered'];
const collectionMethods = ['self_pickup', 'volunteer_delivery'];

const deliverySchema = new mongoose.Schema(
  {
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
    },
    collectionMethod: {
      type: String,
      enum: collectionMethods,
      default: 'volunteer_delivery',
      required: true,
    },
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: deliveryStatuses,
      default: 'pending',
      required: true,
    },
    pickupCodeHash: {
      type: String,
      select: false,
      validate: {
        validator(value) {
          return value == null || sha256DigestPattern.test(value);
        },
        message: 'Pickup code must be stored as a SHA-256 hex digest.',
      },
    },
    deliveryCodeHash: {
      type: String,
      select: false,
      validate: {
        validator(value) {
          return value == null || sha256DigestPattern.test(value);
        },
        message: 'Delivery code must be stored as a SHA-256 hex digest.',
      },
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    pickupTime: {
      type: Date,
      default: null,
    },
    inTransitAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

deliverySchema.pre('validate', function validateDeliveryState() {
  if (
    this.collectionMethod === 'volunteer_delivery' &&
    volunteerRequiredStatuses.includes(this.status) &&
    !this.volunteer
  ) {
    this.invalidate('volunteer', 'This delivery status requires an assigned volunteer.');
  }

  if (this.collectionMethod === 'self_pickup' && this.volunteer) {
    this.invalidate('volunteer', 'Self-pickup deliveries cannot have an assigned volunteer.');
  }

  if (pickupTimeRequiredStatuses.includes(this.status) && !this.pickupTime) {
    this.invalidate('pickupTime', 'This delivery status requires a pickup time.');
  }

  if (this.status === 'assigned' && !this.assignedAt) {
    this.invalidate('assignedAt', 'Assigned deliveries require an assignment time.');
  }

  if (
    this.collectionMethod === 'volunteer_delivery' &&
    ['accepted', 'picked_up', 'in_transit', 'delivered'].includes(this.status) &&
    !this.acceptedAt
  ) {
    this.invalidate('acceptedAt', 'Accepted deliveries require an acceptance time.');
  }

  if (this.status === 'delivered' && !this.deliveredAt) {
    this.invalidate('deliveredAt', 'Delivered records require a delivery time.');
  }

  if (this.status === 'failed' && !this.failedAt) {
    this.invalidate('failedAt', 'Failed deliveries require a failure time.');
  }

  if (this.status === 'cancelled' && !this.cancelledAt) {
    this.invalidate('cancelledAt', 'Cancelled deliveries require a cancellation time.');
  }

  if (
    this.collectionMethod === 'self_pickup' &&
    ['assigned', 'accepted', 'in_transit', 'delivered'].includes(this.status)
  ) {
    this.invalidate('status', 'Self-pickup deliveries cannot enter volunteer delivery states.');
  }
});

deliverySchema.index({ reservation: 1 }, { unique: true });
deliverySchema.index({ volunteer: 1, status: 1, createdAt: -1 });

deliverySchema.set('toJSON', {
  transform(document, result) {
    delete result.pickupCodeHash;
    delete result.deliveryCodeHash;
    delete result.__v;
    return result;
  },
});

module.exports = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);
