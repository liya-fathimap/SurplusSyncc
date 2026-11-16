const express = require('express');
const { query } = require('express-validator');
const {
  getAnalyticsOverview,
  getCategories,
  getMonthly,
  getProviders,
} = require('../controllers/analyticsController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRoles = require('../middleware/authorizeRoles');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const analyticsRoles = authorizeRoles('provider', 'ngo', 'admin');

router.get('/overview', authenticateToken, analyticsRoles, getAnalyticsOverview);
router.get(
  '/monthly',
  authenticateToken,
  analyticsRoles,
  query('months').optional().isInt({ min: 1, max: 36 }).toInt(),
  validateRequest,
  getMonthly,
);
router.get('/categories', authenticateToken, analyticsRoles, getCategories);
router.get(
  '/providers',
  authenticateToken,
  authorizeRoles('admin'),
  getProviders,
);

module.exports = router;
