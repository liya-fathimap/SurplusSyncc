const express = require('express');
const { body } = require('express-validator');
const {
  getAdminCheck,
  getMe,
  login,
  register,
} = require('../controllers/authController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRoles = require('../middleware/authorizeRoles');
const loginRateLimiter = require('../middleware/loginRateLimiter');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const registrationValidators = [
  body('name').isString().withMessage('Name is required.').bail().trim().notEmpty(),
  body('email')
    .isString()
    .withMessage('A valid email is required.')
    .bail()
    .trim()
    .isEmail()
    .withMessage('A valid email is required.'),
  body('password')
    .isString()
    .withMessage('Password is required.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .bail()
    .custom((password) => Buffer.byteLength(password, 'utf8') <= 72)
    .withMessage('Password cannot exceed 72 UTF-8 bytes.'),
  body('role')
    .isString()
    .withMessage('A public account role is required.')
    .bail()
    .isIn(['provider', 'ngo', 'volunteer'])
    .withMessage('Role must be provider, ngo, or volunteer.'),
  body('phone').optional().isString().trim().isLength({ max: 50 }),
  body('organizationName').optional().isString().trim().isLength({ max: 200 }),
  body('address').optional().isString().trim().isLength({ max: 500 }),
];

const loginValidators = [
  body('email')
    .isString()
    .withMessage('A valid email is required.')
    .bail()
    .trim()
    .isEmail()
    .withMessage('A valid email is required.'),
  body('password')
    .isString()
    .withMessage('Password is required.')
    .bail()
    .notEmpty()
    .withMessage('Password is required.'),
];

router.post('/register', registrationValidators, validateRequest, register);
router.post('/login', loginRateLimiter, loginValidators, validateRequest, login);
router.get('/me', authenticateToken, getMe);
router.get('/admin-check', authenticateToken, authorizeRoles('admin'), getAdminCheck);

module.exports = router;
