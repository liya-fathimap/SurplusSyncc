const jwt = require('jsonwebtoken');

const JWT_ISSUER = 'surplussync-api';
const JWT_AUDIENCE = 'surplussync-client';
const ACCESS_TOKEN_TTL = '1h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes.');
  }

  return secret;
}

function validateJwtConfiguration() {
  getJwtSecret();
}

function signAccessToken(userId) {
  return jwt.sign(
    { sub: userId.toString() },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      audience: JWT_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
}

module.exports = { signAccessToken, validateJwtConfiguration, verifyAccessToken };
