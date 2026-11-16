const mongoose = require('mongoose');
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const { resolveMatchingConfig } = require('../config/matching');

const EARTH_RADIUS_KM = 6371.0088;

class MatchingError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'MatchingError';
    this.statusCode = statusCode;
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function calculateDistanceKm(ngo, listing) {
  if (Number.isFinite(ngo.distanceMeters) && ngo.distanceMeters >= 0) {
    return ngo.distanceMeters / 1000;
  }

  const ngoCoordinates = ngo.location && ngo.location.coordinates;
  const listingCoordinates = listing.location && listing.location.coordinates;
  if (
    !Array.isArray(ngoCoordinates) ||
    ngoCoordinates.length !== 2 ||
    !Array.isArray(listingCoordinates) ||
    listingCoordinates.length !== 2
  ) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const [ngoLongitude, ngoLatitude] = ngoCoordinates;
  const [listingLongitude, listingLatitude] = listingCoordinates;
  const latitudeDifference = toRadians(listingLatitude - ngoLatitude);
  const longitudeDifference = toRadians(listingLongitude - ngoLongitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(ngoLatitude)) *
      Math.cos(toRadians(listingLatitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(clamp(haversine, 0, 1)));
}

function getCategoryScore(ngo, foodCategory) {
  const acceptedCategories = Array.isArray(ngo.acceptedFoodCategories)
    ? ngo.acceptedFoodCategories.map(normalizeText).filter(Boolean)
    : [];

  if (acceptedCategories.length > 0 && !acceptedCategories.includes(normalizeText(foodCategory))) {
    return null;
  }

  return {
    score: 100,
    reason:
      acceptedCategories.length === 0
        ? 'No food category restrictions are configured.'
        : `Accepts the ${foodCategory} category.`,
  };
}

function getQuantityCompatibility(ngo, listing) {
  const availableQuantity = listing.availableQuantity;
  const listingUnit = normalizeText(listing.unit);
  const capacities = Array.isArray(ngo.pickupCapacity) ? ngo.pickupCapacity : [];

  if (capacities.length === 0) {
    return {
      score: 50,
      recommendedQuantity: null,
      reason: 'No unit-specific pickup capacity is configured; quantity compatibility is uncertain.',
    };
  }

  const capacity = capacities.find((entry) => normalizeText(entry.unit) === listingUnit);
  if (!capacity || !Number.isFinite(capacity.maxQuantity) || capacity.maxQuantity <= 0) {
    return null;
  }

  const recommendedQuantity = Math.min(availableQuantity, capacity.maxQuantity);
  return {
    score: (recommendedQuantity / availableQuantity) * 100,
    recommendedQuantity,
    reason:
      recommendedQuantity === availableQuantity
        ? `Can collect all ${availableQuantity} ${listing.unit} currently available.`
        : `Can collect ${recommendedQuantity} of the ${availableQuantity} ${listing.unit} currently available.`,
  };
}

function scoreNgoCandidates(listing, candidates, overrides = {}, now = new Date()) {
  const config = resolveMatchingConfig(overrides);
  const recommendations = [];
  const deadline = new Date(listing.collectionDeadline);
  const currentTime = now instanceof Date ? now : new Date(now);
  const availableQuantity = Number(listing.availableQuantity);
  if (
    !Number.isFinite(deadline.getTime()) ||
    !Number.isFinite(currentTime.getTime()) ||
    !Number.isFinite(availableQuantity) ||
    availableQuantity <= 0 ||
    deadline <= currentTime
  ) {
    return recommendations;
  }
  const remainingMinutes = (deadline.getTime() - currentTime.getTime()) / 60000;

  for (const ngo of candidates) {
    if (ngo.role !== 'ngo' || !ngo.isActive || !ngo.isVerified) {
      continue;
    }

    const distanceKm = calculateDistanceKm(ngo, listing);
    if (
      distanceKm === null ||
      !Number.isFinite(distanceKm) ||
      distanceKm < 0 ||
      distanceKm > config.maxDistanceKm
    ) {
      continue;
    }

    const categoryCompatibility = getCategoryScore(ngo, listing.foodCategory);
    if (!categoryCompatibility) {
      continue;
    }

    const quantityCompatibility = getQuantityCompatibility(ngo, listing);
    if (!quantityCompatibility) {
      continue;
    }

    const travelMinutes =
      (distanceKm * config.roadDistanceFactor * 60) / config.averageSpeedKmh;
    const requiredMinutes = travelMinutes + config.collectionBufferMinutes;
    const slackMinutes = remainingMinutes - requiredMinutes;
    if (slackMinutes <= 0) {
      continue;
    }

    const distanceScore = clamp(
      (1 - distanceKm / config.maxDistanceKm) * 100,
      0,
      100,
    );
    const deadlineScore = clamp(
      (slackMinutes / config.deadlineScoreHorizonMinutes) * 100,
      0,
      100,
    );
    const factors = {
      distance: {
        score: distanceScore,
        reason: `Approximately ${round(distanceKm)} km from the pickup location.`,
      },
      quantity: quantityCompatibility,
      category: categoryCompatibility,
      deadline: {
        score: deadlineScore,
        reason: `Estimated travel and collection buffer is ${round(requiredMinutes)} minutes, leaving ${round(slackMinutes)} minutes before the deadline.`,
      },
      verification: {
        score: 100,
        reason: 'NGO account is verified and active.',
      },
    };

    const scoreBreakdown = {};
    let totalScore = 0;
    for (const [factor, result] of Object.entries(factors)) {
      const weight = config.weights[factor];
      const weightedScore = (result.score * weight) / 100;
      totalScore += weightedScore;
      scoreBreakdown[factor] = {
        weight: round(weight),
        score: round(result.score),
        weightedScore: round(weightedScore),
        reason: result.reason,
      };
    }

    recommendations.push({
      ngo: {
        id: ngo._id.toString(),
        name: ngo.name,
        organizationName: ngo.organizationName,
      },
      distanceKm: round(distanceKm),
      estimatedTravelMinutes: round(travelMinutes),
      remainingMinutes: round(remainingMinutes),
      recommendedQuantity: quantityCompatibility.recommendedQuantity,
      unit: listing.unit,
      score: round(totalScore),
      scoreBreakdown,
      reasons: Object.values(factors).map((factor) => factor.reason),
    });
  }

  return recommendations.sort(
    (first, second) =>
      second.score - first.score ||
      first.distanceKm - second.distanceKm ||
      first.ngo.id.localeCompare(second.ngo.id),
  );
}

async function recommendNgosForListing(listingId, overrides = {}) {
  if (!mongoose.Types.ObjectId.isValid(listingId)) {
    throw new MatchingError('Listing id must be a valid MongoDB id.', 400);
  }

  const now = overrides.now ? new Date(overrides.now) : new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new Error('Matching reference time must be a valid date.');
  }
  const config = resolveMatchingConfig(overrides);
  const listing = await FoodListing.findById(listingId).lean();

  if (!listing) {
    throw new MatchingError('Food listing not found.', 404);
  }

  if (
    !['available', 'partially_reserved'].includes(listing.status) ||
    listing.availableQuantity <= 0 ||
    new Date(listing.collectionDeadline) <= now
  ) {
    throw new MatchingError('Food listing is expired or unavailable for matching.', 409);
  }

  const candidates = await User.aggregate([
    {
      $geoNear: {
        near: listing.location,
        distanceField: 'distanceMeters',
        maxDistance: config.maxDistanceKm * 1000,
        spherical: true,
        query: {
          role: 'ngo',
          isActive: true,
          isVerified: true,
          location: { $exists: true },
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        organizationName: 1,
        role: 1,
        isActive: 1,
        isVerified: 1,
        acceptedFoodCategories: 1,
        pickupCapacity: 1,
        distanceMeters: 1,
      },
    },
  ]);

  return {
    listingId: listing._id.toString(),
    recommendations: scoreNgoCandidates(listing, candidates, config, now),
  };
}

async function recommendListingsForNgo(ngoId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(ngoId)) {
    throw new MatchingError('NGO id must be a valid MongoDB id.', 400);
  }

  const now = options.now ? new Date(options.now) : new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new Error('Matching reference time must be a valid date.');
  }
  const config = resolveMatchingConfig(options);
  const ngo = await User.findById(ngoId)
    .select(
      '_id name organizationName role isActive isVerified location acceptedFoodCategories pickupCapacity',
    )
    .lean();

  if (!ngo || ngo.role !== 'ngo') {
    throw new MatchingError('NGO account not found.', 404);
  }
  if (!ngo.isActive || !ngo.isVerified) {
    throw new MatchingError('Only active, verified NGOs can receive recommendations.', 403);
  }
  if (!ngo.location?.coordinates) {
    throw new MatchingError('Add a location to your NGO profile to receive nearby recommendations.', 400);
  }

  const deadlineFilter = { $gt: now };
  if (options.deadlineAfter && options.deadlineAfter > deadlineFilter.$gt) {
    deadlineFilter.$gt = options.deadlineAfter;
  }
  if (options.deadlineBefore) {
    deadlineFilter.$lt = options.deadlineBefore;
  }

  const listingFilter = {
    status: { $in: ['available', 'partially_reserved'] },
    availableQuantity: { $gt: 0 },
    collectionDeadline: deadlineFilter,
  };
  if (options.minQuantity !== undefined) {
    listingFilter.availableQuantity.$gte = options.minQuantity;
  }
  if (options.maxQuantity !== undefined) {
    listingFilter.availableQuantity.$lte = options.maxQuantity;
  }
  if (options.category) {
    listingFilter.foodCategory = {
      $regex: `^${options.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      $options: 'i',
    };
  }

  const listings = await FoodListing.aggregate([
    {
      $geoNear: {
        near: ngo.location,
        distanceField: 'distanceMeters',
        maxDistance: config.maxDistanceKm * 1000,
        spherical: true,
        query: listingFilter,
      },
    },
    { $sort: { collectionDeadline: 1, _id: 1 } },
    { $limit: options.limit || 100 },
    {
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        foodCategory: 1,
        quantity: 1,
        availableQuantity: 1,
        unit: 1,
        collectionDeadline: 1,
        preparedAt: 1,
        storageCondition: 1,
        allergens: 1,
        pickupAddress: 1,
        location: 1,
        provider: 1,
        status: 1,
        distanceMeters: 1,
      },
    },
  ]);
  const recommendations = [];

  for (const listing of listings) {
    const [match] = scoreNgoCandidates(listing, [ngo], config, now);
    if (match) {
      recommendations.push({
        listing: {
          ...listing,
          _id: listing._id.toString(),
        },
        score: match.score,
        scoreBreakdown: match.scoreBreakdown,
        reasons: match.reasons,
        distanceKm: match.distanceKm,
        estimatedTravelMinutes: match.estimatedTravelMinutes,
        recommendedQuantity: match.recommendedQuantity,
        unit: match.unit,
      });
    }
  }

  recommendations.sort(
    (first, second) =>
      second.score - first.score ||
      first.distanceKm - second.distanceKm ||
      new Date(first.listing.collectionDeadline) - new Date(second.listing.collectionDeadline),
  );

  return {
    ngoId: ngo._id.toString(),
    recommendations,
  };
}

module.exports = {
  MatchingError,
  recommendNgosForListing,
  recommendListingsForNgo,
  scoreNgoCandidates,
};
