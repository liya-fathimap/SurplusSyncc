const managedFields = [
  'provider',
  'availableQuantity',
  'reservedQuantity',
  'status',
  'createdAt',
  'updatedAt',
  '__v',
];

function rejectManagedListingFields(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a JSON object.',
    });
  }

  const attemptedFields = managedFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  );

  if (attemptedFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Listing status and inventory fields are managed by the server.',
      errors: attemptedFields.map((field) => ({
        field,
        message: 'This field cannot be set directly.',
      })),
    });
  }

  return next();
}

module.exports = rejectManagedListingFields;
