function errorHandler(error, req, res, next) {
  const requestedStatusCode = error.statusCode || error.status;
  const statusCode =
    Number.isInteger(requestedStatusCode) && requestedStatusCode >= 400 && requestedStatusCode < 600
      ? requestedStatusCode
      : 500;

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : error.message,
  });
}

module.exports = errorHandler;
