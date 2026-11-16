const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createListing,
  deleteListing,
  getListingById,
  getListings,
  getMyListingById,
  getMyListings,
  updateListing,
} = require('../controllers/listingController');
const {
  getListingRecommendations,
  getNgoListingRecommendations,
} = require('../controllers/matchingController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRoles = require('../middleware/authorizeRoles');
const rejectManagedListingFields = require('../middleware/rejectManagedListingFields');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const statuses = [
  'draft',
  'available',
  'partially_reserved',
  'fully_reserved',
  'expired',
  'cancelled',
];
const sortValues = ['deadline_asc', 'deadline_desc', 'newest', 'oldest'];

function requiredText(field, maxLength) {
  return body(field)
    .isString()
    .withMessage(`${field} must be a string.`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${field} is required.`)
    .bail()
    .isLength({ max: maxLength })
    .withMessage(`${field} is too long.`);
}

function optionalText(field, maxLength) {
  return body(field)
    .optional()
    .isString()
    .withMessage(`${field} must be a string.`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${field} cannot be empty.`)
    .bail()
    .isLength({ max: maxLength })
    .withMessage(`${field} is too long.`);
}

function validLocation(optional = false) {
  const validator = body('location');
  if (optional) {
    validator.optional();
  }

  return validator.custom((location) => {
    if (
      !location ||
      typeof location !== 'object' ||
      Array.isArray(location) ||
      location.type !== 'Point' ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      throw new Error('Location must be a GeoJSON Point with [longitude, latitude].');
    }

    const [longitude, latitude] = location.coordinates;
    if (
      typeof longitude !== 'number' ||
      typeof latitude !== 'number' ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new Error('Location coordinates are outside valid longitude/latitude ranges.');
    }

    return true;
  });
}

const createValidators = [
  requiredText('title', 200),
  requiredText('description', 5000),
  requiredText('foodCategory', 100),
  body('quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than zero.').toFloat(),
  requiredText('unit', 50),
  body('preparedAt').isISO8601().withMessage('Preparation time must be a valid ISO date.').toDate(),
  body('collectionDeadline')
    .isISO8601()
    .withMessage('Collection deadline must be a valid ISO date.')
    .toDate(),
  requiredText('storageCondition', 1000),
  body('allergens').isArray().withMessage('Allergens must be an array.'),
  body('allergens.*')
    .isString()
    .withMessage('Each allergen must be a string.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Allergen names cannot be empty.'),
  optionalText('image', 2048),
  requiredText('pickupAddress', 1000),
  validLocation(),
];

const updateValidators = [
  optionalText('title', 200),
  optionalText('description', 5000),
  optionalText('foodCategory', 100),
  body('quantity')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be greater than zero.')
    .toFloat(),
  optionalText('unit', 50),
  body('preparedAt').optional().isISO8601().withMessage('Preparation time must be a valid ISO date.').toDate(),
  body('collectionDeadline')
    .optional()
    .isISO8601()
    .withMessage('Collection deadline must be a valid ISO date.')
    .toDate(),
  optionalText('storageCondition', 1000),
  body('allergens').optional().isArray().withMessage('Allergens must be an array.'),
  body('allergens.*')
    .optional()
    .isString()
    .withMessage('Each allergen must be a string.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Allergen names cannot be empty.'),
  optionalText('image', 2048),
  optionalText('pickupAddress', 1000),
  validLocation(true),
];

const listQueryValidators = [
  query('category').optional().isString().trim().isLength({ min: 1, max: 100 }),
  query('minQuantity').optional().isFloat({ gt: 0 }).toFloat(),
  query('maxQuantity').optional().isFloat({ gt: 0 }).toFloat(),
  query('availability').optional().isIn(['true', 'false']),
  query('deadlineAfter').optional().isISO8601().toDate(),
  query('deadlineBefore').optional().isISO8601().toDate(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(sortValues),
];
const recommendationQueryValidators = [
  query('category').optional().isString().trim().isLength({ min: 1, max: 100 }),
  query('minQuantity').optional().isFloat({ gt: 0 }).toFloat(),
  query('maxQuantity').optional().isFloat({ gt: 0 }).toFloat(),
  query('deadlineAfter').optional().isISO8601().toDate(),
  query('deadlineBefore').optional().isISO8601().toDate(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const myListingQueryValidators = [
  ...listQueryValidators,
  query('status').optional().isIn(statuses),
];

function listingIdValidator() {
  return param('id').isMongoId().withMessage('Listing id must be a valid MongoDB id.');
}

router.post(
  '/',
  authenticateToken,
  authorizeRoles('provider'),
  rejectManagedListingFields,
  createValidators,
  validateRequest,
  createListing,
);
router.get('/', listQueryValidators, validateRequest, getListings);
router.get(
  '/recommendations',
  authenticateToken,
  authorizeRoles('ngo'),
  recommendationQueryValidators,
  validateRequest,
  getNgoListingRecommendations,
);
router.get(
  '/:id/recommendations',
  authenticateToken,
  authorizeRoles('provider'),
  listingIdValidator(),
  validateRequest,
  getListingRecommendations,
);
router.get(
  '/my-listings/:id',
  authenticateToken,
  authorizeRoles('provider'),
  listingIdValidator(),
  validateRequest,
  getMyListingById,
);
router.get('/my-listings', authenticateToken, authorizeRoles('provider'), myListingQueryValidators, validateRequest, getMyListings);
router.get('/:id', listingIdValidator(), validateRequest, getListingById);
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('provider'),
  listingIdValidator(),
  rejectManagedListingFields,
  updateValidators,
  validateRequest,
  updateListing,
);
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('provider'),
  listingIdValidator(),
  validateRequest,
  deleteListing,
);

module.exports = router;
