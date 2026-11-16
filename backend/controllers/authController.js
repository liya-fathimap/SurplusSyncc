const { matchedData } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signAccessToken } = require('../utils/jwt');

const publicRegistrationRoles = ['provider', 'ngo', 'volunteer'];

function publicUser(user) {
  return user.toJSON();
}

function sendValidationError(res, error) {
  return res.status(400).json({
    success: false,
    message: 'Registration data is invalid.',
    errors: Object.values(error.errors).map((fieldError) => ({
      field: fieldError.path,
      message: fieldError.message,
    })),
  });
}

async function register(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });
  const email = input.email.toLowerCase();

  if (!publicRegistrationRoles.includes(input.role)) {
    return res.status(400).json({
      success: false,
      message: 'A valid public account role is required.',
    });
  }

  try {
    if (await User.exists({ email })) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const user = new User({
      name: input.name,
      email,
      password: input.password,
      role: input.role,
      phone: input.phone,
      organizationName: input.organizationName,
      address: input.address,
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        user: publicUser(user),
        token: signAccessToken(user._id),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    if (error.name === 'ValidationError') {
      return sendValidationError(res, error);
    }

    return next(error);
  }
}

async function login(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });
  const email = input.email.toLowerCase();

  try {
    const user = await User.findOne({ email }).select('+password');
    const passwordMatches =
      user && (await bcrypt.compare(input.password, user.password));

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account is inactive.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: publicUser(user),
        token: signAccessToken(user._id),
      },
    });
  } catch (error) {
    return next(error);
  }
}

function getMe(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Current user retrieved successfully.',
    data: { user: publicUser(req.user) },
  });
}

function getAdminCheck(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Admin authorization successful.',
  });
}

module.exports = { getAdminCheck, getMe, login, register };
