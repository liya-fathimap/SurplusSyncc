const Notification = require('../models/Notification');

async function createNotification({
  recipient,
  title,
  message,
  type,
  eventKey,
  session,
}) {
  if (!recipient || typeof eventKey !== 'string' || eventKey.trim() === '') {
    throw new TypeError('Notification recipient and event key are required.');
  }

  const filter = { recipient, eventKey };
  const update = {
    $setOnInsert: {
      recipient,
      title,
      message,
      type,
      eventKey,
      isRead: false,
    },
  };
  const options = {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  };
  if (session) {
    options.session = session;
  }

  try {
    return await Notification.findOneAndUpdate(filter, update, options);
  } catch (error) {
    if (!session && error.code === 11000) {
      const existing = await Notification.findOne(filter);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}

module.exports = { createNotification };
