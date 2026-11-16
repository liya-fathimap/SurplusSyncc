const express = require('express');
const { param, query } = require('express-validator');
const {
  deliveryRoute,
  nearbyListings,
  nearbyNgos,
  nearbyProviders,
} = require('../controllers/locationController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRoles = require('../middleware/authorizeRoles');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const coordinatesValidators = [
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180.')
    .toFloat(),
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90.')
    .toFloat(),
  query('radiusMeters').optional().isFloat({ gt: 0, max: 100000 }).toFloat(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];

router.get(
  '/nearby-listings',
  authenticateToken,
  authorizeRoles('ngo', 'admin'),
  coordinatesValidators,
  validateRequest,
  nearbyListings,
);
router.get(
  '/nearby-providers',
  authenticateToken,
  authorizeRoles('ngo', 'admin'),
  coordinatesValidators,
  validateRequest,
  nearbyProviders,
);
router.get(
  '/nearby-ngos',
  authenticateToken,
  authorizeRoles('admin'),
  coordinatesValidators,
  validateRequest,
  nearbyNgos,
);
router.get(
  '/deliveries/:id/route',
  authenticateToken,
  authorizeRoles('provider', 'ngo', 'volunteer', 'admin'),
  param('id').isMongoId().withMessage('Delivery id must be a valid MongoDB id.'),
  validateRequest,
  deliveryRoute,
);

module.exports = router;
