function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: 'SurplusSync API is healthy',
  });
}

module.exports = { getHealth };
