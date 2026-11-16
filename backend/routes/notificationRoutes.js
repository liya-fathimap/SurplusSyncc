const express = require('express');
const { param, query } = require('express-validator');
const {
  getMyNotifications,
  markNotificationRead,
} = require('../controllers/notificationController');
const authenticateToken = require('../middleware/authenticateToken');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.get(
  '/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('isRead').optional().isBoolean().toBoolean(),
  ],
  validateRequest,
  getMyNotifications,
);
router.patch(
  '/:id/read',
  authenticateToken,
  param('id').isMongoId().withMessage('Notification id must be a valid MongoDB id.'),
  validateRequest,
  markNotificationRead,
);

module.exports = router;
