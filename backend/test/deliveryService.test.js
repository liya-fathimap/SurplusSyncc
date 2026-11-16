const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const Notification = require('../models/Notification');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const {
  acceptDelivery,
  assignDelivery,
  getMyDeliveries,
  issueVerificationQr,
  cancelDelivery,
  failDelivery,
  markInTransit,
  verifyDelivery,
  verifyPickup,
} = require('../services/deliveryService');

function createHarness({
  collectionMethod = 'volunteer_delivery',
  status = 'pending',
  availableQuantity = 4,
} = {}) {
  const providerId = new mongoose.Types.ObjectId();
  const ngoId = new mongoose.Types.ObjectId();
  const volunteerId = new mongoose.Types.ObjectId();
  const otherVolunteerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId();
  const reservationId = new mongoose.Types.ObjectId();
  const deliveryId = new mongoose.Types.ObjectId();
  const logs = [];
  const notifications = new Map();
  const listing = {
    _id: listingId,
    provider: providerId,
    quantity: 10,
    availableQuantity,
    status: availableQuantity === 0 ? 'fully_reserved' : 'partially_reserved',
    collectionDeadline: new Date(Date.now() + 60 * 60 * 1000),
    async save() {
      return this;
    },
  };
  const reservation = {
    _id: reservationId,
    foodListing: listingId,
    ngo: ngoId,
    requestedQuantity: 6,
    approvedQuantity: 6,
    collectionMethod,
    status: 'confirmed',
    confirmedAt: new Date(),
    async save() {
      return this;
    },
  };
  const delivery = {
    _id: deliveryId,
    reservation: reservationId,
    collectionMethod,
    volunteer: status === 'pending' ? null : volunteerId,
    status,
    pickupCodeHash: null,
    deliveryCodeHash: null,
    assignedAt: status === 'assigned' ? new Date() : null,
    acceptedAt: ['accepted', 'picked_up', 'in_transit'].includes(status)
      ? new Date()
      : null,
    pickupTime: ['picked_up', 'in_transit'].includes(status) ? new Date() : null,
    inTransitAt: status === 'in_transit' ? new Date() : null,
    deliveredAt: null,
    async save() {
      return this;
    },
  };
  let transactionQueue = Promise.resolve();
  const session = {
    async withTransaction(operation) {
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation(session);
      } finally {
        release();
      }
    },
    async endSession() {},
  };

  function asQuery(value) {
    return {
      session() {
        return this;
      },
      select() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(value).then(resolve, reject);
      },
    };
  }

  function matchesDelivery(filter) {
    for (const [field, expected] of Object.entries(filter)) {
      if (field.startsWith('$')) continue;
      const actual = delivery[field];
      if (expected && typeof expected === 'object' && !mongoose.isValidObjectId(expected)) {
        if (expected.$in && !expected.$in.includes(actual)) return false;
        if (expected.$ne !== undefined && String(actual) === String(expected.$ne)) return false;
      } else if (String(actual) !== String(expected)) {
        return false;
      }
    }
    return true;
  }

  const originals = {
    startSession: mongoose.startSession,
    deliveryFindById: Delivery.findById,
    deliveryFindOneAndUpdate: Delivery.findOneAndUpdate,
    deliveryFind: Delivery.find,
    deliverySave: Delivery.prototype.save,
    listingFindById: FoodListing.findById,
    listingFindOneAndUpdate: FoodListing.findOneAndUpdate,
    reservationFindById: Reservation.findById,
    reservationSave: Reservation.prototype.save,
    userFindOne: User.findOne,
    activityCreate: ActivityLog.create,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
  };

  mongoose.startSession = async () => session;
  Delivery.findById = (id) =>
    asQuery(String(id) === String(deliveryId) ? delivery : null);
  Delivery.findOneAndUpdate = async (filter, update) => {
    if (!matchesDelivery(filter)) return null;
    for (const [field, value] of Object.entries(update.$set || {})) {
      delivery[field] = value;
    }
    for (const field of Object.keys(update.$unset || {})) {
      delivery[field] = undefined;
    }
    return delivery;
  };
  Delivery.find = () => ({
    sort() {
      return this;
    },
    populate() {
      return this;
    },
    lean: async () => [],
  });
  Delivery.prototype.save = async function saveDelivery() {
    return this;
  };
  FoodListing.findById = (id) =>
    asQuery(String(id) === String(listingId) ? listing : null);
  FoodListing.findOneAndUpdate = async (filter, update) => {
    if (
      String(filter._id) !== String(listingId) ||
      listing.availableQuantity > filter.availableQuantity.$lte
    ) {
      return null;
    }
    listing.availableQuantity += update.$inc.availableQuantity;
    return listing;
  };
  Reservation.findById = (id) =>
    asQuery(String(id) === String(reservationId) ? reservation : null);
  Reservation.prototype.save = async function saveReservation() {
    return this;
  };
  User.findOne = () => asQuery({ _id: volunteerId });
  ActivityLog.create = async (entries) => {
    logs.push(...entries);
    return entries;
  };
  Notification.findOneAndUpdate = async (filter, update) => ({
    ...notifications.set(
      `${filter.recipient}:${filter.eventKey}`,
      update.$setOnInsert,
    ).get(`${filter.recipient}:${filter.eventKey}`),
  });

  function restore() {
    mongoose.startSession = originals.startSession;
    Delivery.findById = originals.deliveryFindById;
    Delivery.findOneAndUpdate = originals.deliveryFindOneAndUpdate;
    Delivery.find = originals.deliveryFind;
    Delivery.prototype.save = originals.deliverySave;
    FoodListing.findById = originals.listingFindById;
    FoodListing.findOneAndUpdate = originals.listingFindOneAndUpdate;
    Reservation.findById = originals.reservationFindById;
    Reservation.prototype.save = originals.reservationSave;
    User.findOne = originals.userFindOne;
    ActivityLog.create = originals.activityCreate;
    Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
  }

  return {
    delivery,
    deliveryId,
    listing,
    logs,
    ngoId,
    notifications,
    otherVolunteerId,
    providerId,
    reservation,
    restore,
    volunteerId,
  };
}

test('only one volunteer can accept a delivery task', async () => {
  const harness = createHarness();
  try {
    const outcomes = await Promise.allSettled([
      acceptDelivery({
        deliveryId: harness.deliveryId,
        volunteerId: harness.volunteerId,
      }),
      acceptDelivery({
        deliveryId: harness.deliveryId,
        volunteerId: harness.otherVolunteerId,
      }),
    ]);

    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    assert.equal(
      outcomes.filter(
        (outcome) => outcome.status === 'rejected' && outcome.reason.statusCode === 409,
      ).length,
      1,
    );
    assert.equal(harness.delivery.status, 'accepted');
    assert.ok(
      [harness.volunteerId, harness.otherVolunteerId].some(
        (id) => String(id) === String(harness.delivery.volunteer),
      ),
    );
  } finally {
    harness.restore();
  }
});

test('provider assignment notifies the volunteer and the volunteer can accept it', async () => {
  const harness = createHarness();
  try {
    await assignDelivery({
      deliveryId: harness.deliveryId,
      providerId: harness.providerId,
      volunteerId: harness.volunteerId,
    });

    assert.equal(harness.delivery.status, 'assigned');
    assert.equal(
      [...harness.notifications.values()][0].type,
      'delivery_assigned',
    );

    await acceptDelivery({
      deliveryId: harness.deliveryId,
      volunteerId: harness.volunteerId,
    });
    assert.equal(harness.delivery.status, 'accepted');
  } finally {
    harness.restore();
  }
});

test('providers can load delivery records linked to their own listings', async () => {
  const providerId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId();
  const reservationId = new mongoose.Types.ObjectId();
  const originalListingDistinct = FoodListing.distinct;
  const originalReservationDistinct = Reservation.distinct;
  const originalDeliveryFind = Delivery.find;

  try {
    FoodListing.distinct = async (field, filter) => {
      assert.equal(field, '_id');
      assert.equal(String(filter.provider), String(providerId));
      return [listingId];
    };
    Reservation.distinct = async (field, filter) => {
      assert.equal(field, '_id');
      assert.deepEqual(filter, { foodListing: { $in: [listingId] } });
      return [reservationId];
    };
    Delivery.find = (filter) => {
      assert.deepEqual(filter, { reservation: { $in: [reservationId] } });
      return {
        sort() { return this; },
        populate() { return this; },
        lean: async () => [],
      };
    };

    assert.deepEqual(
      await getMyDeliveries({ userId: providerId, role: 'provider' }),
      [],
    );
  } finally {
    FoodListing.distinct = originalListingDistinct;
    Reservation.distinct = originalReservationDistinct;
    Delivery.find = originalDeliveryFind;
  }
});

test('pickup and delivery QR codes are hashed, role-verified, and one-time use', async () => {
  const harness = createHarness({ status: 'accepted' });
  try {
    const pickupQr = await issueVerificationQr({
      deliveryId: harness.deliveryId,
      userId: harness.volunteerId,
      role: 'volunteer',
      stage: 'pickup',
    });

    assert.match(pickupQr.qrCode, /^data:image\/png;base64,/);
    assert.notEqual(harness.delivery.pickupCodeHash, pickupQr.verificationCode);
    assert.match(harness.delivery.pickupCodeHash, /^[a-f\d]{64}$/i);

    await assert.rejects(
      verifyPickup({
        deliveryId: harness.deliveryId,
        providerId: harness.ngoId,
        code: pickupQr.verificationCode,
      }),
      { statusCode: 404 },
    );

    await verifyPickup({
      deliveryId: harness.deliveryId,
      providerId: harness.providerId,
      code: pickupQr.verificationCode,
    });
    assert.equal(harness.delivery.status, 'picked_up');
    assert.equal(harness.delivery.pickupCodeHash, undefined);

    await assert.rejects(
      verifyPickup({
        deliveryId: harness.deliveryId,
        providerId: harness.providerId,
        code: pickupQr.verificationCode,
      }),
      { statusCode: 409 },
    );

    await markInTransit({
      deliveryId: harness.deliveryId,
      volunteerId: harness.volunteerId,
    });
    const deliveryQr = await issueVerificationQr({
      deliveryId: harness.deliveryId,
      userId: harness.volunteerId,
      role: 'volunteer',
      stage: 'delivery',
    });
    await verifyDelivery({
      deliveryId: harness.deliveryId,
      ngoId: harness.ngoId,
      code: deliveryQr.verificationCode,
    });

    assert.equal(harness.delivery.status, 'delivered');
    assert.equal(harness.reservation.status, 'completed');
    assert.ok(
      [...harness.notifications.values()].some(
        (notification) => notification.type === 'delivery_completed',
      ),
    );
    assert.equal(harness.delivery.deliveryCodeHash, undefined);
    await assert.rejects(
      verifyDelivery({
        deliveryId: harness.deliveryId,
        ngoId: harness.ngoId,
        code: deliveryQr.verificationCode,
      }),
      { statusCode: 409 },
    );
  } finally {
    harness.restore();
  }
});

test('self-pickup completes when the provider verifies the pickup QR', async () => {
  const harness = createHarness({
    collectionMethod: 'self_pickup',
    status: 'pending',
  });
  try {
    const pickupQr = await issueVerificationQr({
      deliveryId: harness.deliveryId,
      userId: harness.ngoId,
      role: 'ngo',
      stage: 'pickup',
    });

    await verifyPickup({
      deliveryId: harness.deliveryId,
      providerId: harness.providerId,
      code: pickupQr.verificationCode,
    });

    assert.equal(harness.delivery.status, 'picked_up');
    assert.equal(harness.reservation.status, 'completed');
    assert.ok(
      [...harness.notifications.values()].some(
        (notification) => notification.type === 'delivery_completed',
      ),
    );
  } finally {
    harness.restore();
  }
});

test('pre-pickup failure or cancellation restores stock and closes the reservation', async () => {
  const failedHarness = createHarness({ status: 'accepted' });
  try {
    await failDelivery({
      deliveryId: failedHarness.deliveryId,
      volunteerId: failedHarness.volunteerId,
      reason: 'Vehicle issue',
    });
    assert.equal(failedHarness.delivery.status, 'failed');
    assert.equal(failedHarness.reservation.status, 'cancelled');
    assert.equal(failedHarness.listing.availableQuantity, 10);
  } finally {
    failedHarness.restore();
  }

  const cancelledHarness = createHarness({ status: 'accepted' });
  try {
    await cancelDelivery({
      deliveryId: cancelledHarness.deliveryId,
      actorId: cancelledHarness.ngoId,
      role: 'ngo',
    });

    assert.equal(cancelledHarness.delivery.status, 'cancelled');
    assert.equal(cancelledHarness.reservation.status, 'cancelled');
    assert.equal(cancelledHarness.listing.availableQuantity, 10);
  } finally {
    cancelledHarness.restore();
  }
});

test('failure after pickup does not return transported food to available inventory', async () => {
  const harness = createHarness({ status: 'in_transit' });
  try {
    await failDelivery({
      deliveryId: harness.deliveryId,
      volunteerId: harness.volunteerId,
      reason: 'Vehicle breakdown',
    });

    assert.equal(harness.delivery.status, 'failed');
    assert.equal(harness.reservation.status, 'failed');
    assert.equal(harness.listing.availableQuantity, 4);
  } finally {
    harness.restore();
  }
});
