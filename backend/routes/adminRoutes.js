const express = require('express');
const { body, param, query } = require('express-validator');
const {
  activateUser,
  getActivityLogs,
  getDeliveryMonitor,
  getFoodListingMonitor,
  getReservationMonitor,
  getUser,
  getUsers,
  verifyUser,
} = require('../controllers/adminController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRoles = require('../middleware/authorizeRoles');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const userRoles = ['provider', 'ngo', 'volunteer', 'admin'];
const listingStatuses = [
  'draft',
  'available',
  'partially_reserved',
  'fully_reserved',
  'expired',
  'cancelled',
];
const reservationStatuses = [
  'pending',
  'confirmed',
  'rejected',
  'cancelled',
  'completed',
  'failed',
];
const deliveryStatuses = [
  'pending',
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
  'cancelled',
];
const activityEntityTypes = ['User', 'FoodListing', 'Reservation', 'Delivery', 'Notification'];

const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100.')
    .toInt(),
];

function validId(name, label) {
  return param(name).isMongoId().withMessage(`${label} must be a valid MongoDB id.`);
}

function optionalDate(name) {
  return query(name)
    .optional()
    .isISO8601()
    .withMessage(`${name} must be a valid ISO date.`)
    .toDate();
}

const userListValidators = [
  ...paginationValidators,
  query('role').optional().isIn(userRoles).withMessage('Role is invalid.'),
  query('verificationStatus')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'not_required'])
    .withMessage('Verification status is invalid.'),
  query('verified').optional().isIn(['true', 'false']).toBoolean(),
  query('active').optional().isIn(['true', 'false']).toBoolean(),
];
const listingValidators = [
  ...paginationValidators,
  query('status').optional().isIn(listingStatuses).withMessage('Listing status is invalid.'),
  query('providerId').optional().isMongoId().withMessage('Provider id must be a valid MongoDB id.'),
  optionalDate('createdAfter'),
  optionalDate('createdBefore'),
];
const reservationValidators = [
  ...paginationValidators,
  query('status')
    .optional()
    .isIn(reservationStatuses)
    .withMessage('Reservation status is invalid.'),
  query('ngoId').optional().isMongoId().withMessage('NGO id must be a valid MongoDB id.'),
  query('foodListingId')
    .optional()
    .isMongoId()
    .withMessage('Food listing id must be a valid MongoDB id.'),
  optionalDate('requestedAfter'),
  optionalDate('requestedBefore'),
];
const deliveryValidators = [
  ...paginationValidators,
  query('status').optional().isIn(deliveryStatuses).withMessage('Delivery status is invalid.'),
  query('volunteerId')
    .optional()
    .isMongoId()
    .withMessage('Volunteer id must be a valid MongoDB id.'),
  optionalDate('createdAfter'),
  optionalDate('createdBefore'),
];
const activityLogValidators = [
  ...paginationValidators,
  query('actorId').optional().isMongoId().withMessage('Actor id must be a valid MongoDB id.'),
  query('entityType').optional().isIn(activityEntityTypes).withMessage('Entity type is invalid.'),
  query('action').optional().isString().trim().isLength({ min: 1, max: 120 }),
  optionalDate('from'),
  optionalDate('to'),
];

router.use(authenticateToken, authorizeRoles('admin'));

router.get('/users', userListValidators, validateRequest, getUsers);
router.get('/users/:id', validId('id', 'User id'), validateRequest, getUser);
router.patch(
  '/users/:id/activation',
  validId('id', 'User id'),
  body('active').isBoolean().withMessage('Active must be a boolean.').toBoolean(),
  validateRequest,
  activateUser,
);
router.patch(
  '/users/:id/verification',
  validId('id', 'User id'),
  body('decision').isIn(['approve', 'reject']).withMessage('Decision must be approve or reject.'),
  validateRequest,
  verifyUser,
);
router.get('/listings', listingValidators, validateRequest, getFoodListingMonitor);
router.get('/reservations', reservationValidators, validateRequest, getReservationMonitor);
router.get('/deliveries', deliveryValidators, validateRequest, getDeliveryMonitor);
router.get('/activity-logs', activityLogValidators, validateRequest, getActivityLogs);

module.exports = router;
