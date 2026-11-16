const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const { getDeliveryRoute } = require('../services/locationService');

function locationQuery(req) {
  const longitude = Number(req.query.longitude);
  const latitude = Number(req.query.latitude);
  const radiusMeters = Number(req.query.radiusMeters || 50000);
  const limit = Number(req.query.limit || 25);

  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    const error = new Error('Valid longitude and latitude coordinates are required.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 100000) {
    const error = new Error('radiusMeters must be greater than zero and at most 100000.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    const error = new Error('limit must be an integer between 1 and 50.');
    error.statusCode = 400;
    throw error;
  }

  return {
    near: { type: 'Point', coordinates: [longitude, latitude] },
    radiusMeters,
    limit,
  };
}

function ensureVerifiedNgo(user) {
  if (user.role === 'ngo' && !user.isVerified) {
    const error = new Error('Only verified NGOs can access nearby organization locations.');
    error.statusCode = 403;
    throw error;
  }
}

async function nearbyListings(req, res, next) {
  try {
    ensureVerifiedNgo(req.user);
    const { near, radiusMeters, limit } = locationQuery(req);
    const listings = await FoodListing.aggregate([
      {
        $geoNear: {
          near,
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          query: {
            status: { $in: ['available', 'partially_reserved'] },
            availableQuantity: { $gt: 0 },
            collectionDeadline: { $gt: new Date() },
          },
        },
      },
      { $sort: { distanceMeters: 1, collectionDeadline: 1 } },
      { $limit: limit },
      {
        $project: {
          title: 1,
          foodCategory: 1,
          availableQuantity: 1,
          unit: 1,
          pickupAddress: 1,
          collectionDeadline: 1,
          location: 1,
          distanceMeters: 1,
        },
      },
    ]);

    return res.json({
      success: true,
      message: 'Nearby food listings retrieved successfully.',
      data: { listings },
    });
  } catch (error) {
    return next(error);
  }
}

async function nearbyProviders(req, res, next) {
  try {
    ensureVerifiedNgo(req.user);
    const { near, radiusMeters, limit } = locationQuery(req);
    const providers = await User.aggregate([
      {
        $geoNear: {
          near,
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          query: {
            role: 'provider',
            isActive: true,
            isVerified: true,
            $or: [
              { verificationStatus: 'approved' },
              { verificationStatus: { $exists: false } },
            ],
          },
        },
      },
      { $sort: { distanceMeters: 1 } },
      { $limit: limit },
      {
        $project: {
          organizationName: 1,
          location: 1,
          distanceMeters: 1,
        },
      },
    ]);

    return res.json({
      success: true,
      message: 'Nearby verified providers retrieved successfully.',
      data: { providers },
    });
  } catch (error) {
    return next(error);
  }
}

async function nearbyNgos(req, res, next) {
  try {
    const { near, radiusMeters, limit } = locationQuery(req);
    const ngos = await User.aggregate([
      {
        $geoNear: {
          near,
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          query: {
            role: 'ngo',
            isActive: true,
            isVerified: true,
            $or: [
              { verificationStatus: 'approved' },
              { verificationStatus: { $exists: false } },
            ],
          },
        },
      },
      { $sort: { distanceMeters: 1 } },
      { $limit: limit },
      {
        $project: {
          organizationName: 1,
          location: 1,
          distanceMeters: 1,
        },
      },
    ]);

    return res.json({
      success: true,
      message: 'Nearby verified NGOs retrieved successfully.',
      data: { ngos },
    });
  } catch (error) {
    return next(error);
  }
}

async function deliveryRoute(req, res, next) {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate({
        path: 'reservation',
        select: 'foodListing ngo',
        populate: [
          { path: 'foodListing', select: 'provider pickupAddress location' },
          { path: 'ngo', select: 'organizationName location' },
        ],
      })
      .lean();

    if (!delivery?.reservation?.foodListing || !delivery.reservation.ngo) {
      return res.status(404).json({ success: false, message: 'Delivery not found.' });
    }

    const { foodListing, ngo } = delivery.reservation;
    const userId = String(req.user._id);
    const isAllowed =
      req.user.role === 'admin' ||
      (req.user.role === 'provider' && String(foodListing.provider) === userId) ||
      (req.user.role === 'ngo' && String(ngo._id) === userId) ||
      (req.user.role === 'volunteer' &&
        (delivery.status === 'pending' || String(delivery.volunteer) === userId));

    if (!isAllowed) {
      return res.status(404).json({ success: false, message: 'Delivery not found.' });
    }

    if (!Array.isArray(foodListing.location?.coordinates) || !Array.isArray(ngo.location?.coordinates)) {
      return res.status(409).json({
        success: false,
        message: 'Pickup or destination coordinates are unavailable for this delivery.',
      });
    }

    const route = await getDeliveryRoute(
      foodListing.location.coordinates,
      ngo.location.coordinates,
    );
    return res.json({
      success: true,
      message: 'Delivery route retrieved successfully.',
      data: {
        pickup: {
          address: foodListing.pickupAddress,
          location: foodListing.location,
        },
        destination: {
          organizationName: ngo.organizationName,
          location: ngo.location,
        },
        route,
        routingProvider: 'OSRM public demo server',
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  deliveryRoute,
  nearbyListings,
  nearbyNgos,
  nearbyProviders,
};
