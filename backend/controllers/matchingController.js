const { matchedData } = require('express-validator');
const FoodListing = require('../models/FoodListing');
const {
  MatchingError,
  recommendNgosForListing,
  recommendListingsForNgo,
} = require('../services/matchingService');

async function getListingRecommendations(req, res, next) {
  try {
    const listing = await FoodListing.findOne({
      _id: req.params.id,
      provider: req.user._id,
    })
      .select('_id')
      .lean();

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Food listing not found.',
      });
    }

    const data = await recommendNgosForListing(listing._id);
    return res.status(200).json({
      success: true,
      message: 'NGO recommendations retrieved successfully.',
      data,
    });
  } catch (error) {
    if (error instanceof MatchingError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

async function getNgoListingRecommendations(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  try {
    const data = await recommendListingsForNgo(req.user._id, input);
    return res.status(200).json({
      success: true,
      message: 'Recommended food listings retrieved successfully.',
      data,
    });
  } catch (error) {
    if (error instanceof MatchingError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

module.exports = {
  getListingRecommendations,
  getNgoListingRecommendations,
};
