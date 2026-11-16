const { matchedData } = require('express-validator');
const {
  getCategoryDistribution,
  getMonthlyStatistics,
  getOverview,
  getProviderPerformance,
} = require('../services/analyticsService');

async function getAnalyticsOverview(req, res, next) {
  try {
    const data = await getOverview({
      role: req.user.role,
      userId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Analytics overview retrieved successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMonthly(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });

  try {
    const data = await getMonthlyStatistics({
      role: req.user.role,
      userId: req.user._id,
      months: input.months || 12,
    });

    return res.status(200).json({
      success: true,
      message: 'Monthly redistribution statistics retrieved successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getCategories(req, res, next) {
  try {
    const categories = await getCategoryDistribution({
      role: req.user.role,
      userId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Food category distribution retrieved successfully.',
      data: { categories },
    });
  } catch (error) {
    return next(error);
  }
}

async function getProviders(req, res, next) {
  try {
    const providers = await getProviderPerformance();

    return res.status(200).json({
      success: true,
      message: 'Provider redistribution performance retrieved successfully.',
      data: { providers },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAnalyticsOverview,
  getCategories,
  getMonthly,
  getProviders,
};
