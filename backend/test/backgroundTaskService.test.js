const assert = require('node:assert/strict');
const test = require('node:test');
const FoodListing = require('../models/FoodListing');
const Notification = require('../models/Notification');
const {
  expireFoodListings,
  notifyProvidersBeforeDeadlines,
} = require('../services/backgroundTaskService');

test('expiry job conditionally targets active listings whose deadline has passed', async () => {
  const originalUpdateMany = FoodListing.updateMany;
  let observedFilter;
  let observedUpdate;
  FoodListing.updateMany = async (filter, update) => {
    observedFilter = filter;
    observedUpdate = update;
    return { modifiedCount: 3 };
  };

  try {
    const now = new Date('2026-11-14T10:00:00.000Z');
    const count = await expireFoodListings({ now });

    assert.equal(count, 3);
    assert.deepEqual(observedFilter.status.$in, [
      'available',
      'partially_reserved',
      'fully_reserved',
    ]);
    assert.equal(observedFilter.collectionDeadline.$lte, now);
    assert.equal(observedUpdate.$set.status, 'expired');
  } finally {
    FoodListing.updateMany = originalUpdateMany;
  }
});

test('deadline reminder job uses a stable event key to avoid duplicate notices', async () => {
  const originalFind = FoodListing.find;
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const providerId = 'provider-1';
  const now = new Date('2026-11-14T10:00:00.000Z');
  const listing = {
    _id: 'listing-1',
    provider: providerId,
    title: 'Prepared meals',
    collectionDeadline: new Date('2026-11-14T14:00:00.000Z'),
  };
  const records = new Map();
  let observedFilter;

  FoodListing.find = (filter) => {
    observedFilter = filter;
    return {
      select() {
        return this;
      },
      lean: async () => [listing],
    };
  };
  Notification.findOneAndUpdate = async (filter, update) => {
    const key = `${filter.recipient}:${filter.eventKey}`;
    if (!records.has(key)) {
      records.set(key, update.$setOnInsert);
    }
    return records.get(key);
  };

  try {
    await notifyProvidersBeforeDeadlines({ now, reminderHours: 24 });
    await notifyProvidersBeforeDeadlines({ now, reminderHours: 24 });

    assert.equal(records.size, 1);
    assert.equal(observedFilter.collectionDeadline.$gt, now);
    assert.equal(
      observedFilter.collectionDeadline.$lte.toISOString(),
      '2026-11-15T10:00:00.000Z',
    );
    assert.equal(
      [...records.values()][0].eventKey,
      'food-listing:listing-1:deadline:2026-11-14T14:00:00.000Z:24h',
    );
  } finally {
    FoodListing.find = originalFind;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
