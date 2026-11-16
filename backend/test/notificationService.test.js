const assert = require('node:assert/strict');
const test = require('node:test');
const Notification = require('../models/Notification');
const { createNotification } = require('../services/notificationService');

test('notification event keys make repeated event delivery idempotent', async () => {
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const originalFindOne = Notification.findOne;
  const records = new Map();
  Notification.findOneAndUpdate = async (filter, update) => {
    const key = `${filter.recipient}:${filter.eventKey}`;
    if (!records.has(key)) {
      records.set(key, update.$setOnInsert);
    }
    return records.get(key);
  };
  Notification.findOne = async (filter) =>
    records.get(`${filter.recipient}:${filter.eventKey}`) || null;

  try {
    const payload = {
      recipient: 'ngo-1',
      title: 'Reservation confirmed',
      message: 'Your request was approved.',
      type: 'reservation_confirmed',
      eventKey: 'reservation:r-1:confirmed',
    };

    const first = await createNotification(payload);
    const repeated = await createNotification(payload);
    const differentEvent = await createNotification({
      ...payload,
      eventKey: 'reservation:r-1:cancelled',
    });

    assert.equal(records.size, 2);
    assert.equal(first, repeated);
    assert.notEqual(first, differentEvent);
    assert.equal(first.isRead, false);
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
    Notification.findOne = originalFindOne;
  }
});
