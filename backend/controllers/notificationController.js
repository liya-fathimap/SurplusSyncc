const { matchedData } = require('express-validator');
const Notification = require('../models/Notification');

async function getMyNotifications(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const page = input.page || 1;
  const limit = input.limit || 20;
  const filter = { recipient: req.user._id };
  if (input.isRead !== undefined) {
    filter.isRead = input.isRead;
  }

  try {
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully.',
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true, runValidators: true },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: { notification },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMyNotifications,
  markNotificationRead,
};
