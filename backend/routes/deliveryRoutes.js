const express = require('express');
const { body, param } = require('express-validator');
const {
  accept,
  assign,
  cancel,
  delivered,
  fail,
  getAvailable,
  getMine,
  inTransit,
  pickup,
  requestVerificationQr,
} = require('../controllers/deliveryController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRoles = require('../middleware/authorizeRoles');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const deliveryIdValidator = param('id')
  .isMongoId()
  .withMessage('Delivery id must be a valid MongoDB id.');
const codeValidator = body('code')
  .isString()
  .isLength({ min: 64, max: 64 })
  .isHexadecimal()
  .withMessage('A valid QR verification code is required.');

router.get(
  '/available',
  authenticateToken,
  authorizeRoles('volunteer'),
  getAvailable,
);
router.get(
  '/my-deliveries',
  authenticateToken,
  authorizeRoles('provider', 'volunteer', 'ngo'),
  getMine,
);
router.patch(
  '/:id/assign',
  authenticateToken,
  authorizeRoles('provider'),
  deliveryIdValidator,
  body('volunteerId')
    .isMongoId()
    .withMessage('Volunteer id must be a valid MongoDB id.'),
  validateRequest,
  assign,
);
router.post(
  '/:id/accept',
  authenticateToken,
  authorizeRoles('volunteer'),
  deliveryIdValidator,
  validateRequest,
  accept,
);
router.post(
  '/:id/verification-qr',
  authenticateToken,
  authorizeRoles('volunteer', 'ngo'),
  deliveryIdValidator,
  body('stage').isIn(['pickup', 'delivery']),
  validateRequest,
  requestVerificationQr,
);
router.post(
  '/:id/verify-pickup',
  authenticateToken,
  authorizeRoles('provider'),
  deliveryIdValidator,
  codeValidator,
  validateRequest,
  pickup,
);
router.patch(
  '/:id/in-transit',
  authenticateToken,
  authorizeRoles('volunteer'),
  deliveryIdValidator,
  validateRequest,
  inTransit,
);
router.post(
  '/:id/verify-delivery',
  authenticateToken,
  authorizeRoles('ngo'),
  deliveryIdValidator,
  codeValidator,
  validateRequest,
  delivered,
);
router.post(
  '/:id/fail',
  authenticateToken,
  authorizeRoles('volunteer'),
  deliveryIdValidator,
  body('reason').optional().trim().isLength({ max: 500 }),
  validateRequest,
  fail,
);
router.post(
  '/:id/cancel',
  authenticateToken,
  authorizeRoles('provider', 'ngo'),
  deliveryIdValidator,
  validateRequest,
  cancel,
);

module.exports = router;
