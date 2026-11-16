const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const {
  completedReservationPipeline,
  getMonthlyStatistics,
  getOverview,
  providerPerformancePipeline,
} = require('../services/analyticsService');

test('completed redistribution pipeline scopes completed reservations and sums approved quantities', () => {
  const ngoId = new mongoose.Types.ObjectId();
  const providerId = new mongoose.Types.ObjectId();
  const since = new Date('2026-01-01T00:00:00.000Z');
  const pipeline = completedReservationPipeline({
    ngoId,
    providerId,
    since,
    groupBy: '$listing.unit',
  });

  assert.deepEqual(pipeline[0].$match, {
    status: 'completed',
    approvedQuantity: { $gt: 0 },
    ngo: ngoId,
  });
  assert.ok(pipeline.some((stage) => stage.$match?.completionDate?.$gte === since));
  assert.ok(pipeline.some((stage) => stage.$match?.['listing.provider'] === providerId));
  assert.ok(
    pipeline.some((stage) => stage.$group?.redistributedQuantity?.$sum === '$approvedQuantity'),
  );
  assert.ok(
    pipeline.some(
      (stage) =>
        stage.$addFields?.completionDate?.$ifNull?.[0] === '$completedAt' &&
        stage.$addFields.completionDate.$ifNull[1] === '$updatedAt',
    ),
  );
});

test('provider performance aggregation is scoped to the requested provider', () => {
  const providerId = new mongoose.Types.ObjectId();
  const now = new Date('2026-11-14T10:00:00.000Z');
  const pipeline = providerPerformancePipeline({ providerId, now });

  assert.equal(pipeline[0].$match.provider, providerId);
  assert.ok(
    pipeline.some((stage) => stage.$lookup?.from === 'reservations'),
  );
  assert.ok(
    pipeline.some((stage) => stage.$group?.quantityRedistributed?.$sum),
  );
});

test('admin overview returns measured quantities per unit and platform counts', async () => {
  const originals = {
    listingAggregate: FoodListing.aggregate,
    listingCount: FoodListing.countDocuments,
    reservationAggregate: Reservation.aggregate,
    reservationCount: Reservation.countDocuments,
    deliveryAggregate: Delivery.aggregate,
    userCount: User.countDocuments,
  };
  FoodListing.aggregate = async () => [
    { _id: 'kg', quantity: 75 },
    { _id: 'meal', quantity: 20 },
  ];
  FoodListing.countDocuments = async () => 4;
  Reservation.aggregate = async () => [
    { _id: 'kg', redistributedQuantity: 18 },
    { _id: 'meal', redistributedQuantity: 12 },
  ];
  Reservation.countDocuments = async () => 5;
  Delivery.aggregate = async () => [{ successfulDeliveries: 3 }];
  User.countDocuments = async (filter) =>
    filter.role === 'provider' ? 7 : 9;

  try {
    const now = new Date('2026-11-14T10:00:00.000Z');
    const overview = await getOverview({ role: 'admin', now });

    assert.deepEqual(overview.totalFoodQuantityListed, [
      { unit: 'kg', quantity: 75 },
      { unit: 'meal', quantity: 20 },
    ]);
    assert.deepEqual(overview.totalFoodQuantityRedistributed, [
      { unit: 'kg', quantity: 18 },
      { unit: 'meal', quantity: 12 },
    ]);
    assert.equal(overview.activeFoodListings, 4);
    assert.equal(overview.completedReservations, 5);
    assert.equal(overview.successfulDeliveries, 3);
    assert.equal(overview.activeProviders, 7);
    assert.equal(overview.verifiedNgos, 9);
    assert.equal(overview.environmentalImpact.status, 'not_calculated');
  } finally {
    FoodListing.aggregate = originals.listingAggregate;
    FoodListing.countDocuments = originals.listingCount;
    Reservation.aggregate = originals.reservationAggregate;
    Reservation.countDocuments = originals.reservationCount;
    Delivery.aggregate = originals.deliveryAggregate;
    User.countDocuments = originals.userCount;
  }
});

test('monthly statistics scope completed quantities to the authenticated NGO', async () => {
  const originalAggregate = Reservation.aggregate;
  const ngoId = new mongoose.Types.ObjectId();
  let observedPipeline;
  Reservation.aggregate = async (pipeline) => {
    observedPipeline = pipeline;
    return [
      {
        _id: { month: '2026-11', unit: 'kg' },
        redistributedQuantity: 8,
        completedReservations: 2,
      },
    ];
  };

  try {
    const now = new Date('2026-11-14T10:00:00.000Z');
    const statistics = await getMonthlyStatistics({
      role: 'ngo',
      userId: ngoId,
      months: 3,
      now,
    });

    assert.equal(observedPipeline[0].$match.status, 'completed');
    assert.equal(observedPipeline[0].$match.ngo, ngoId);
    assert.equal(observedPipeline[0].$match.approvedQuantity.$gt, 0);
    assert.equal(statistics.statistics[0].quantityRedistributed, 8);
    assert.equal(statistics.months, 3);
  } finally {
    Reservation.aggregate = originalAggregate;
  }
});
