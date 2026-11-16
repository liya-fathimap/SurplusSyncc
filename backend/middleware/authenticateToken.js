const mongoose = require('mongoose');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');

function sendUnauthorized(res, message) {
  return res.status(401).json({ success: false, message });
}

async function authenticateToken(req, res, next) {
  const authorization = req.get('authorization');

  if (!authorization) {
    return sendUnauthorized(res, 'Authentication token is required.');
  }

  const bearerMatch = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!bearerMatch) {
    return sendUnauthorized(res, 'Authorization header must use Bearer token format.');
  }

  let payload;
  try {
    payload = verifyAccessToken(bearerMatch[1]);
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      return sendUnauthorized(res, 'Invalid or expired authentication token.');
    }

    return next(error);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.sub !== 'string' ||
    !mongoose.isValidObjectId(payload.sub)
  ) {
    return sendUnauthorized(res, 'Invalid or expired authentication token.');
  }

  const user = await User.findById(payload.sub).select(
    '_id name email role phone organizationName address location isVerified isActive createdAt',
  );

  if (!user || !user.isActive) {
    return sendUnauthorized(res, 'User account is unavailable.');
  }

  req.user = user;
  return next();
}

module.exports = authenticateToken;
