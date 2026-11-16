const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const Notification = require('../models/Notification');
const Reservation = require('../models/Reservation');
const {
  cancelReservation,
  confirmReservation,
  createReservation,
  rejectReservation,
} = require('../services/reservationService');

function createHarness({ availableQuantity = 10, quantity = 10 } = {}) {
  const providerId = new mongoose.Types.ObjectId();
  const ngoId = new mongoose.Types.ObjectId();
  const listingId = new mongoose.Types.ObjectId();
  const reservations = new Map();
  const logs = [];
  const notifications = new Map();
  const listing = {
    _id: listingId,
    provider: providerId,
    quantity,
    availableQuantity,
    status: availableQuantity === quantity ? 'available' : 'partially_reserved',
    collectionDeadline: new Date(Date.now() + 60 * 60 * 1000),
    async save() {
      return this;
    },
  };
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
  let transactionQueue = Promise.resolve();

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

  function matchesListing(filter) {
    if (filter._id && String(filter._id) !== String(listing._id)) return false;
    if (filter.provider && String(filter.provider) !== String(listing.provider)) return false;
    if (filter.status && !filter.status.$in.includes(listing.status)) return false;
    if (
      filter.collectionDeadline &&
      !(listing.collectionDeadline > filter.collectionDeadline.$gt)
    ) {
      return false;
    }
    if (
      filter.availableQuantity &&
      filter.availableQuantity.$gt !== undefined &&
      !(listing.availableQuantity > filter.availableQuantity.$gt)
    ) {
      return false;
    }
    if (
      filter.availableQuantity &&
      filter.availableQuantity.$gte !== undefined &&
      !(listing.availableQuantity >= filter.availableQuantity.$gte)
    ) {
      return false;
    }
    if (
      filter.availableQuantity &&
      filter.availableQuantity.$lte !== undefined &&
      !(listing.availableQuantity <= filter.availableQuantity.$lte)
    ) {
      return false;
    }
    if (filter.quantity !== undefined && filter.quantity !== listing.quantity) return false;
    return true;
  }

  const originals = {
    startSession: mongoose.startSession,
    deliveryFindOne: Delivery.findOne,
    deliverySave: Delivery.prototype.save,
    findById: FoodListing.findById,
    findOne: FoodListing.findOne,
    findOneAndUpdate: FoodListing.findOneAndUpdate,
    reservationFindById: Reservation.findById,
    reservationFindOne: Reservation.findOne,
    reservationSave: Reservation.prototype.save,
    activityCreate: ActivityLog.create,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
  };

  mongoose.startSession = async () => session;
  Delivery.findOne = () => asQuery(null);
  Delivery.prototype.save = async function saveDelivery() {
    if (!this._id) this._id = new mongoose.Types.ObjectId();
    return this;
  };
  FoodListing.findById = (id) => asQuery(String(id) === String(listing._id) ? listing : null);
  FoodListing.findOne = (filter) => asQuery(matchesListing(filter) ? listing : null);
  FoodListing.findOneAndUpdate = async (filter, update) => {
    if (!matchesListing(filter)) return null;
    listing.availableQuantity += update.$inc.availableQuantity;
    return listing;
  };
  Reservation.findById = (id) =>
    asQuery(reservations.get(String(id)) || null);
  Reservation.findOne = (filter) => {
    const reservation = reservations.get(String(filter._id));
    return asQuery(
      reservation && String(reservation.ngo) === String(filter.ngo) ? reservation : null,
    );
  };
  Reservation.prototype.save = async function saveReservation() {
    if (!this._id) this._id = new mongoose.Types.ObjectId();
    reservations.set(String(this._id), this);
    return this;
  };
  ActivityLog.create = async (entries) => {
    logs.push(...entries);
    return entries;
  };
  Notification.findOneAndUpdate = async (filter, update) => {
    const key = `${filter.recipient}:${filter.eventKey}`;
    if (!notifications.has(key)) {
      notifications.set(key, update.$setOnInsert);
    }
    return notifications.get(key);
  };

  function addReservation(requestedQuantity, status = 'pending') {
    const id = new mongoose.Types.ObjectId();
    const reservation = {
      _id: id,
      foodListing: listingId,
      ngo: ngoId,
      requestedQuantity,
      approvedQuantity: status === 'confirmed' ? requestedQuantity : null,
      collectionMethod: 'volunteer_delivery',
      status,
      confirmedAt: status === 'confirmed' ? new Date() : null,
      async save() {
        reservations.set(String(this._id), this);
        return this;
      },
    };
    reservations.set(String(id), reservation);
    return reservation;
  }

  function restore() {
    mongoose.startSession = originals.startSession;
    Delivery.findOne = originals.deliveryFindOne;
    Delivery.prototype.save = originals.deliverySave;
    FoodListing.findById = originals.findById;
    FoodListing.findOne = originals.findOne;
    FoodListing.findOneAndUpdate = originals.findOneAndUpdate;
    Reservation.findById = originals.reservationFindById;
    Reservation.findOne = originals.reservationFindOne;
    Reservation.prototype.save = originals.reservationSave;
    ActivityLog.create = originals.activityCreate;
    Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
  }

  return {
    addReservation,
    listing,
    logs,
    ngoId,
    notifications,
    providerId,
    reservations,
    restore,
  };
}

test('pending requests do not allocate stock and cannot request more than current availability', async () => {
  const harness = createHarness({ availableQuantity: 5, quantity: 5 });
  try {
    const ngo = { _id: harness.ngoId, role: 'ngo', isActive: true, isVerified: true };
    const reservation = await createReservation({
      ngo,
      foodListingId: harness.listing._id,
      requestedQuantity: 4,
      collectionMethod: 'self_pickup',
    });

    assert.equal(reservation.status, 'pending');
    assert.equal(harness.listing.availableQuantity, 5);
    assert.equal(harness.logs.length, 1);
    await assert.rejects(
      createReservation({
        ngo,
        foodListingId: harness.listing._id,
        requestedQuantity: 6,
        collectionMethod: 'self_pickup',
      }),
      { statusCode: 409 },
    );
  } finally {
    harness.restore();
  }
});

test('simultaneous confirmations cannot allocate the same inventory twice', async () => {
  const harness = createHarness({ availableQuantity: 10, quantity: 10 });
  try {
    const first = harness.addReservation(6);
    const second = harness.addReservation(6);
    const results = await Promise.allSettled([
      confirmReservation({
        reservationId: first._id,
        providerId: harness.providerId,
      }),
      confirmReservation({
        reservationId: second._id,
        providerId: harness.providerId,
      }),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(
      results.filter(
        (result) => result.status === 'rejected' && result.reason.statusCode === 409,
      ).length,
      1,
    );
    assert.equal(harness.listing.availableQuantity, 4);
    assert.equal(
      [...harness.reservations.values()].filter(
        (reservation) => reservation.status === 'confirmed',
      ).length,
      1,
    );
    assert.equal(harness.notifications.size, 1);
    assert.equal(
      [...harness.notifications.values()][0].type,
      'reservation_confirmed',
    );
  } finally {
    harness.restore();
  }
});

test('providers can confirm less than the requested quantity', async () => {
  const harness = createHarness({ availableQuantity: 10, quantity: 10 });
  try {
    const reservation = harness.addReservation(8);

    await confirmReservation({
      reservationId: reservation._id,
      providerId: harness.providerId,
      approvedQuantity: 3,
    });

    assert.equal(reservation.approvedQuantity, 3);
    assert.equal(reservation.status, 'confirmed');
    assert.equal(harness.listing.availableQuantity, 7);
    assert.equal(harness.listing.status, 'partially_reserved');
  } finally {
    harness.restore();
  }
});

test('confirmation returns a conflict and leaves records unchanged when inventory is insufficient', async () => {
  const harness = createHarness({ availableQuantity: 3, quantity: 10 });
  try {
    const reservation = harness.addReservation(5);

    await assert.rejects(
      confirmReservation({
        reservationId: reservation._id,
        providerId: harness.providerId,
      }),
      { statusCode: 409 },
    );

    assert.equal(harness.listing.availableQuantity, 3);
    assert.equal(reservation.status, 'pending');
    assert.equal(harness.logs.length, 0);
  } finally {
    harness.restore();
  }
});

test('rejecting or cancelling a pending request does not change inventory', async () => {
  const harness = createHarness({ availableQuantity: 10, quantity: 10 });
  try {
    const rejected = harness.addReservation(3);
    const cancelled = harness.addReservation(2);

    await rejectReservation({
      reservationId: rejected._id,
      providerId: harness.providerId,
    });
    await cancelReservation({
      reservationId: cancelled._id,
      ngoId: harness.ngoId,
    });

    assert.equal(harness.listing.availableQuantity, 10);
    assert.equal(rejected.status, 'rejected');
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(harness.logs.length, 2);
    assert.deepEqual(
      [...harness.notifications.values()].map((notification) => notification.type).sort(),
      ['reservation_cancelled', 'reservation_rejected'],
    );
  } finally {
    harness.restore();
  }
});

test('cancelling a confirmed reservation restores stock and updates listing state', async () => {
  const harness = createHarness({ availableQuantity: 4, quantity: 10 });
  try {
    const reservation = harness.addReservation(6, 'confirmed');

    await cancelReservation({
      reservationId: reservation._id,
      ngoId: harness.ngoId,
    });

    assert.equal(harness.listing.availableQuantity, 10);
    assert.equal(harness.listing.status, 'available');
    assert.equal(reservation.status, 'cancelled');
    assert.equal(harness.logs.length, 1);
  } finally {
    harness.restore();
  }
});
