const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const validation = validationResult(req);

  if (validation.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    success: false,
    message: 'Validation failed.',
    errors: validation.array().map((error) => ({
      field: error.path,
      message: error.msg,
    })),
  });
}

module.exports = validateRequest;
