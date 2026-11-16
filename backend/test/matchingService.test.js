const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const {
  recommendListingsForNgo,
  recommendNgosForListing,
  scoreNgoCandidates,
} = require('../services/matchingService');
const sampleData = require('./fixtures/matchingSampleData.json');
const listing = {
  ...sampleData.listing,
  preparedAt: new Date(sampleData.listing.preparedAt),
  collectionDeadline: new Date(sampleData.listing.collectionDeadline),
};
const ngos = sampleData.ngos;
const referenceTime = new Date(sampleData.referenceTime);

test('scores suitable NGOs, explains each factor, and sorts by total score', () => {
  const recommendations = scoreNgoCandidates(listing, ngos, {}, referenceTime);

  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].ngo.name, 'Nearby Community Kitchen');
  assert.ok(recommendations[0].score >= 0 && recommendations[0].score <= 100);
  assert.deepEqual(
    Object.keys(recommendations[0].scoreBreakdown),
    ['distance', 'quantity', 'category', 'deadline', 'verification'],
  );
  assert.ok(recommendations[0].reasons.length > 0);
  assert.ok(recommendations[0].score >= recommendations[1].score);
});

test('excludes inactive, unverified, wrong-category, incompatible-unit, and late NGOs', () => {
  const unsuitableNgos = [
    { ...ngos[0], _id: 'inactive', isActive: false },
    { ...ngos[0], _id: 'unverified', isVerified: false },
    { ...ngos[0], _id: 'wrong-category', acceptedFoodCategories: ['dairy'] },
    { ...ngos[0], _id: 'wrong-unit', pickupCapacity: [{ unit: 'meal', maxQuantity: 10 }] },
    { ...ngos[0], _id: 'too-late', distanceMeters: 49000 },
    { ...ngos[0], _id: 'wrong-role', role: 'provider' },
  ];

  const shortDeadlineListing = {
    ...listing,
    collectionDeadline: new Date(referenceTime.getTime() + 60 * 60000),
  };
  assert.deepEqual(
    scoreNgoCandidates(shortDeadlineListing, unsuitableNgos, {}, referenceTime),
    [],
  );
});

test('reports partial pickup capacity and supports configurable weights', () => {
  const partialCapacityNgo = {
    ...ngos[0],
    pickupCapacity: [{ unit: 'kg', maxQuantity: 6 }],
  };
  const [recommendation] = scoreNgoCandidates(
    listing,
    [partialCapacityNgo],
    { weights: { distance: 100, quantity: 0, category: 0, deadline: 0, verification: 0 } },
    referenceTime,
  );

  assert.equal(recommendation.recommendedQuantity, 6);
  assert.equal(recommendation.scoreBreakdown.quantity.score, 40);
  assert.equal(recommendation.score, recommendation.scoreBreakdown.distance.score);
  assert.match(recommendation.scoreBreakdown.quantity.reason, /Can collect 6 of the 15 kg/);
});

test('validates NGO pickup-capacity data without duplicate units', async () => {
  const ngo = new User({
    name: 'Capacity Kitchen',
    email: 'capacity@example.org',
    password: 'valid-password',
    role: 'ngo',
    pickupCapacity: [
      { unit: 'kg', maxQuantity: 10 },
      { unit: 'KG', maxQuantity: 12 },
    ],
  });

  await assert.rejects(ngo.validate(), (error) => Boolean(error.errors.pickupCapacity));
});

test('queries eligible NGOs with a bounded MongoDB $geoNear stage', async () => {
  const originalFindById = FoodListing.findById;
  const originalAggregate = User.aggregate;
  let pipeline;

  try {
    FoodListing.findById = () => ({ lean: async () => listing });
    User.aggregate = async (value) => {
      pipeline = value;
      return ngos;
    };

    const result = await recommendNgosForListing(listing._id, {
      maxDistanceKm: 25,
      now: referenceTime,
    });

    assert.equal(result.listingId, listing._id);
    assert.equal(result.recommendations.length, 2);
    assert.equal(pipeline[0].$geoNear.maxDistance, 25000);
    assert.deepEqual(pipeline[0].$geoNear.query, {
      role: 'ngo',
      isActive: true,
      isVerified: true,
      location: { $exists: true },
    });
  } finally {
    FoodListing.findById = originalFindById;
    User.aggregate = originalAggregate;
  }
});

test('refuses invalid IDs and expired or unavailable listings', async () => {
  await assert.rejects(recommendNgosForListing('not-an-id'), {
    name: 'MatchingError',
    statusCode: 400,
  });

  const originalFindById = FoodListing.findById;
  try {
    const unavailableListings = [
      { ...listing, status: 'expired' },
      { ...listing, status: 'cancelled' },
      { ...listing, status: 'fully_reserved', availableQuantity: 0 },
      {
        ...listing,
        collectionDeadline: new Date(referenceTime.getTime() - 60000),
      },
    ];

    for (const unavailableListing of unavailableListings) {
      FoodListing.findById = () => ({ lean: async () => unavailableListing });
      await assert.rejects(recommendNgosForListing(listing._id), {
        name: 'MatchingError',
        statusCode: 409,
      });
    }
  } finally {
    FoodListing.findById = originalFindById;
  }
});

test('recommends nearby food listings to an eligible NGO with matching explanations', async () => {
  const ngoId = new mongoose.Types.ObjectId();
  const ngo = {
    _id: ngoId,
    name: 'Nearby Community Kitchen',
    role: 'ngo',
    isActive: true,
    isVerified: true,
    location: listing.location,
    acceptedFoodCategories: ['produce'],
    pickupCapacity: [{ unit: 'kg', maxQuantity: 10 }],
  };
  const candidateListing = {
    ...listing,
    _id: '6736d8d09a6b0f625c5f7a11',
    title: 'Fresh produce',
    description: 'Seasonal vegetables',
    location: ngo.location,
  };
  const originalFindById = User.findById;
  const originalAggregate = FoodListing.aggregate;
  let pipeline;

  try {
    User.findById = () => ({
      select() { return this; },
      lean: async () => ngo,
    });
    FoodListing.aggregate = async (value) => {
      pipeline = value;
      return [candidateListing];
    };

    const result = await recommendListingsForNgo(ngoId, {
      category: 'Produce',
      minQuantity: 5,
      maxQuantity: 12,
      now: referenceTime,
    });

    assert.equal(result.recommendations.length, 1);
    assert.equal(result.recommendations[0].listing.title, 'Fresh produce');
    assert.ok(result.recommendations[0].score >= 0);
    assert.ok(result.recommendations[0].reasons.length > 0);
    assert.equal(pipeline[0].$geoNear.near, ngo.location);
    assert.equal(pipeline[0].$geoNear.query.availableQuantity.$gte, 5);
    assert.equal(pipeline[0].$geoNear.query.availableQuantity.$lte, 12);
  } finally {
    User.findById = originalFindById;
    FoodListing.aggregate = originalAggregate;
  }
});
