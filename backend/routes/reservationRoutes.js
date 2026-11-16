const express = require('express');
const { body, param, query } = require('express-validator');
const {
  cancel,
  confirm,
  getMyReservationById,
  getMyReservations,
  getProviderReservations,
  reject,
  requestReservation,
} = require('../controllers/reservationController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRoles = require('../middleware/authorizeRoles');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const reservationStatuses = [
  'pending',
  'confirmed',
  'rejected',
  'cancelled',
  'completed',
  'failed',
];
const collectionMethods = ['self_pickup', 'volunteer_delivery'];
const idValidator = param('id')
  .isMongoId()
  .withMessage('Reservation id must be a valid MongoDB id.');
const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(reservationStatuses),
];
const providerReservationValidators = [
  ...paginationValidators,
  query('foodListingId')
    .optional()
    .isMongoId()
    .withMessage('Food listing id must be a valid MongoDB id.'),
];

router.post(
  '/',
  authenticateToken,
  authorizeRoles('ngo'),
  [
    body('foodListingId')
      .isMongoId()
      .withMessage('Food listing id must be a valid MongoDB id.'),
    body('requestedQuantity')
      .isFloat({ gt: 0 })
      .withMessage('Requested quantity must be greater than zero.')
      .toFloat(),
    body('collectionMethod')
      .isIn(collectionMethods)
      .withMessage('Collection method must be self_pickup or volunteer_delivery.'),
  ],
  validateRequest,
  requestReservation,
);

router.get(
  '/my-reservations/:id',
  authenticateToken,
  authorizeRoles('ngo'),
  idValidator,
  validateRequest,
  getMyReservationById,
);
router.get(
  '/my-reservations',
  authenticateToken,
  authorizeRoles('ngo'),
  paginationValidators,
  validateRequest,
  getMyReservations,
);
router.get(
  '/',
  authenticateToken,
  authorizeRoles('provider'),
  providerReservationValidators,
  validateRequest,
  getProviderReservations,
);
router.patch(
  '/:id/confirm',
  authenticateToken,
  authorizeRoles('provider'),
  idValidator,
  body('approvedQuantity')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Approved quantity must be greater than zero.')
    .toFloat(),
  validateRequest,
  confirm,
);
router.patch(
  '/:id/reject',
  authenticateToken,
  authorizeRoles('provider'),
  idValidator,
  validateRequest,
  reject,
);
router.patch(
  '/:id/cancel',
  authenticateToken,
  authorizeRoles('ngo'),
  idValidator,
  validateRequest,
  cancel,
);

module.exports = router;
