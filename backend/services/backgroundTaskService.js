const FoodListing = require('../models/FoodListing');
const { createNotification } = require('./notificationService');

const expirableStatuses = ['available', 'partially_reserved', 'fully_reserved'];
const deadlineReminderHours = 24;

async function expireFoodListings({ now = new Date() } = {}) {
  const result = await FoodListing.updateMany(
    {
      status: { $in: expirableStatuses },
      collectionDeadline: { $lte: now },
    },
    { $set: { status: 'expired' } },
  );

  return result.modifiedCount;
}

async function notifyProvidersBeforeDeadlines({
  now = new Date(),
  reminderHours = deadlineReminderHours,
} = {}) {
  if (!Number.isFinite(reminderHours) || reminderHours <= 0) {
    throw new TypeError('Reminder hours must be a positive number.');
  }

  const cutoff = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
  const listings = await FoodListing.find({
    status: { $in: expirableStatuses },
    collectionDeadline: { $gt: now, $lte: cutoff },
  })
    .select('_id provider title collectionDeadline')
    .lean();

  for (const listing of listings) {
    await createNotification({
      recipient: listing.provider,
      title: 'Food collection deadline approaching',
      message: `"${listing.title}" must be collected by ${listing.collectionDeadline.toISOString()}.`,
      type: 'listing_deadline_reminder',
      eventKey: `food-listing:${listing._id}:deadline:${listing.collectionDeadline.toISOString()}:${reminderHours}h`,
    });
  }

  return listings.length;
}

module.exports = {
  deadlineReminderHours,
  expireFoodListings,
  notifyProvidersBeforeDeadlines,
};
