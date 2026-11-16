const cron = require('node-cron');
const {
  expireFoodListings,
  notifyProvidersBeforeDeadlines,
} = require('../services/backgroundTaskService');

function scheduleJob(name, expression, task) {
  return cron.schedule(expression, async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[background-job:${name}] Execution failed:`, error);
    }
  });
}

function startBackgroundJobs() {
  const expiryJob = scheduleJob('expire-food-listings', '*/5 * * * *', () =>
    expireFoodListings(),
  );
  const reminderJob = scheduleJob('deadline-reminders', '*/15 * * * *', () =>
    notifyProvidersBeforeDeadlines(),
  );

  console.log('Background jobs started (listing expiry: 5 min; reminders: 15 min).');
  return [expiryJob, reminderJob];
}

module.exports = { startBackgroundJobs };
