process.env.JWT_SECRET = 'surplussync-integration-test-secret-32-bytes';

if (process.env.SURPLUS_SYNC_NODE_TEST === '1') {
  const nodeTest = require('node:test');
  global.describe = nodeTest.describe;
  global.test = nodeTest.test;
  global.beforeAll = nodeTest.before;
  global.afterAll = nodeTest.after;
  global.beforeEach = nodeTest.beforeEach;
  global.afterEach = nodeTest.afterEach;
  global.expect = require('expect').expect;
}

const mongoose = require('mongoose');
const request = require('supertest');
const { randomUUID } = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const getMongoBinaryOptions = require('./mongoBinaryOptions.cjs');
const { signAccessToken } = require('../utils/jwt');
const app = require('../app');
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');

let replicaSet;

async function connectTestDatabase() {
  replicaSet = await MongoMemoryReplSet.create({
    ...getMongoBinaryOptions(),
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([FoodListing.createIndexes(), User.createIndexes()]);
}

async function disconnectTestDatabase() {
  await mongoose.disconnect();
  if (replicaSet) await replicaSet.stop();
  replicaSet = undefined;
}

async function clearTestDatabase() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
}

async function createAccount(role, options = {}) {
  const email = options.email || `${role}-${randomUUID()}@example.test`;
  const password = 'Test-password-123!';
  let token;
  if (role === 'admin') {
    const user = new User({
      name: options.name || 'Test Admin',
      email,
      password,
      role,
      isVerified: true,
      verificationStatus: 'not_required',
      location: options.location,
    });
    await user.save();
    token = signAccessToken(user._id);
  } else {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: options.name || `Test ${role}`,
        email,
        password,
        role,
        organizationName: options.organizationName || `Test ${role} organization`,
      });
    if (response.status !== 201) {
      throw new Error(`Could not create ${role} fixture: ${response.status} ${response.text}`);
    }
    token = response.body.data.token;

    const user = await User.findOne({ email });
    user.location = options.location;
    if (['ngo', 'provider'].includes(role)) {
      user.isVerified = true;
      user.verificationStatus = 'approved';
    }
    await user.save();
  }

  const account = await User.findOne({ email }).select('_id').lean();
  return {
    email,
    id: String(account._id),
    role,
    token,
  };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function listingPayload(overrides = {}) {
  const preparedAt = new Date(Date.now() - 60 * 60 * 1000);
  return {
    title: `Integration meal ${randomUUID()}`,
    description: 'Prepared meal for an isolated integration test.',
    foodCategory: 'prepared meals',
    quantity: 10,
    unit: 'portions',
    preparedAt: preparedAt.toISOString(),
    collectionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    storageCondition: 'Refrigerated',
    allergens: [],
    pickupAddress: '100 Test Street',
    location: { type: 'Point', coordinates: [-73.987, 40.758] },
    ...overrides,
  };
}

async function createListing(provider, overrides = {}) {
  const response = await request(app)
    .post('/api/listings')
    .set(auth(provider.token))
    .send(listingPayload(overrides));
  if (response.status !== 201) {
    throw new Error(`Could not create listing fixture: ${response.status} ${response.text}`);
  }
  return response.body.data.listing;
}

async function requestAndConfirm(provider, ngo, listing, overrides = {}) {
  const reservationResponse = await request(app)
    .post('/api/reservations')
    .set(auth(ngo.token))
    .send({
      foodListingId: listing._id,
      requestedQuantity: overrides.requestedQuantity || 2,
      collectionMethod: overrides.collectionMethod || 'volunteer_delivery',
    });
  if (reservationResponse.status !== 201) {
    throw new Error(`Could not create reservation fixture: ${reservationResponse.status} ${reservationResponse.text}`);
  }

  const reservation = reservationResponse.body.data.reservation;
  const confirmation = await request(app)
    .patch(`/api/reservations/${reservation._id}/confirm`)
    .set(auth(provider.token))
    .send({ approvedQuantity: overrides.approvedQuantity || 2 });
  if (confirmation.status !== 200) {
    throw new Error(`Could not confirm reservation fixture: ${confirmation.status} ${confirmation.text}`);
  }
  return confirmation.body.data;
}

module.exports = {
  app,
  auth,
  clearTestDatabase,
  connectTestDatabase,
  createAccount,
  createListing,
  disconnectTestDatabase,
  listingPayload,
  request,
  requestAndConfirm,
};
