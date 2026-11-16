const { matchedData } = require('express-validator');
const ActivityLog = require('../models/ActivityLog');
const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const { publishDomainEvent } = require('../realtime/domainEventBus');

const userProjection =
  '_id name email phone role organizationName address location isVerified verificationStatus isActive createdAt';

function pagination(input) {
  const page = input.page || 1;
  const limit = input.limit || 20;
  return { page, limit, skip: (page - 1) * limit };
}

function dateRange(filter, field, after, before) {
  if (after || before) {
    filter[field] = {};
    if (after) filter[field].$gte = after;
    if (before) filter[field].$lte = before;
  }
}

function paginatedResponse(res, message, key, records, page, limit, total) {
  return res.status(200).json({
    success: true,
    message,
    data: {
      [key]: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
}

function notFound(res, resource) {
  return res.status(404).json({
    success: false,
    message: `${resource} not found.`,
  });
}

async function getUsers(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip } = pagination(input);
  const filter = {};
  if (input.role) filter.role = input.role;
  if (input.verified !== undefined) filter.isVerified = input.verified;
  if (input.verificationStatus === 'pending') {
    filter.$or = [
      { verificationStatus: 'pending' },
      { verificationStatus: { $exists: false }, isVerified: false, role: { $in: ['provider', 'ngo'] } },
    ];
  } else if (input.verificationStatus === 'approved') {
    filter.$or = [
      { verificationStatus: 'approved' },
      { verificationStatus: { $exists: false }, isVerified: true },
    ];
  } else if (input.verificationStatus) {
    filter.verificationStatus = input.verificationStatus;
  }
  if (input.active !== undefined) filter.isActive = input.active;

  try {
    const [users, total] = await Promise.all([
      User.find(filter)
        .select(userProjection)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return paginatedResponse(res, 'Users retrieved successfully.', 'users', users, page, limit, total);
  } catch (error) {
    return next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select(userProjection).lean();
    if (!user) return notFound(res, 'User');

    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully.',
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

async function activateUser(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });

  if (String(req.params.id) === String(req.user._id) && input.active === false) {
    return res.status(409).json({
      success: false,
      message: 'Administrators cannot deactivate their own account.',
    });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, 'User');

    const previousValue = user.isActive;
    if (previousValue !== input.active) {
      user.isActive = input.active;
      await user.save();
      await ActivityLog.create({
        actor: req.user._id,
        action: input.active ? 'admin.user.activated' : 'admin.user.deactivated',
        entityType: 'User',
        entityId: user._id,
        details: { previousIsActive: previousValue, isActive: input.active },
      });
      if (!input.active) {
        publishDomainEvent('account:deactivated', { userId: String(user._id) });
      }
    }

    return res.status(200).json({
      success: true,
      message: `User ${input.active ? 'activated' : 'deactivated'} successfully.`,
      data: { user: user.toObject() },
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyUser(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });

  try {
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, 'User');
    if (!['provider', 'ngo'].includes(user.role)) {
      return res.status(409).json({
        success: false,
        message: 'Only providers and NGOs can have their verification status changed.',
      });
    }

    const isVerified = input.decision === 'approve';
    const verificationStatus = isVerified ? 'approved' : 'rejected';
    const previousValue = user.verificationStatus || (user.isVerified ? 'approved' : 'pending');
    if (previousValue !== verificationStatus || user.isVerified !== isVerified) {
      user.isVerified = isVerified;
      user.verificationStatus = verificationStatus;
      await user.save();
      await ActivityLog.create({
        actor: req.user._id,
        action: isVerified ? 'admin.user.verified' : 'admin.user.verification_rejected',
        entityType: 'User',
        entityId: user._id,
        details: {
          role: user.role,
          previousVerificationStatus: previousValue,
          verificationStatus,
          isVerified,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `User verification ${verificationStatus} successfully.`,
      data: { user: user.toObject() },
    });
  } catch (error) {
    return next(error);
  }
}

async function getFoodListingMonitor(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip } = pagination(input);
  const filter = {};
  if (input.status) filter.status = input.status;
  if (input.providerId) filter.provider = input.providerId;
  dateRange(filter, 'createdAt', input.createdAfter, input.createdBefore);

  try {
    const [listings, total] = await Promise.all([
      FoodListing.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('provider', 'name email organizationName role isVerified isActive')
        .lean(),
      FoodListing.countDocuments(filter),
    ]);
    return paginatedResponse(
      res,
      'Food listings retrieved successfully.',
      'listings',
      listings,
      page,
      limit,
      total,
    );
  } catch (error) {
    return next(error);
  }
}

async function getReservationMonitor(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip } = pagination(input);
  const filter = {};
  if (input.status) filter.status = input.status;
  if (input.ngoId) filter.ngo = input.ngoId;
  if (input.foodListingId) filter.foodListing = input.foodListingId;
  dateRange(filter, 'requestedAt', input.requestedAfter, input.requestedBefore);

  try {
    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .sort({ requestedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'foodListing',
          select: 'title foodCategory quantity availableQuantity unit collectionDeadline status provider',
          populate: { path: 'provider', select: 'name email organizationName role' },
        })
        .populate('ngo', 'name email organizationName role isVerified isActive')
        .lean(),
      Reservation.countDocuments(filter),
    ]);
    return paginatedResponse(
      res,
      'Reservations retrieved successfully.',
      'reservations',
      reservations,
      page,
      limit,
      total,
    );
  } catch (error) {
    return next(error);
  }
}

async function getDeliveryMonitor(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip } = pagination(input);
  const filter = {};
  if (input.status) filter.status = input.status;
  if (input.volunteerId) filter.volunteer = input.volunteerId;
  dateRange(filter, 'createdAt', input.createdAfter, input.createdBefore);

  try {
    const [deliveries, total] = await Promise.all([
      Delivery.find(filter)
        .select('-pickupCodeHash -deliveryCodeHash')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('volunteer', 'name email phone role isActive')
        .populate({
          path: 'reservation',
          select: 'status requestedQuantity approvedQuantity collectionMethod requestedAt ngo foodListing',
          populate: [
            { path: 'ngo', select: 'name email organizationName role' },
            { path: 'foodListing', select: 'title foodCategory provider' },
          ],
        })
        .lean(),
      Delivery.countDocuments(filter),
    ]);
    return paginatedResponse(
      res,
      'Deliveries retrieved successfully.',
      'deliveries',
      deliveries,
      page,
      limit,
      total,
    );
  } catch (error) {
    return next(error);
  }
}

async function getActivityLogs(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip } = pagination(input);
  const filter = {};
  if (input.actorId) filter.actor = input.actorId;
  if (input.entityType) filter.entityType = input.entityType;
  if (input.action) filter.action = input.action;
  dateRange(filter, 'createdAt', input.from, input.to);

  try {
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'name email role')
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);
    return paginatedResponse(
      res,
      'Activity logs retrieved successfully.',
      'activityLogs',
      logs,
      page,
      limit,
      total,
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  activateUser,
  getActivityLogs,
  getDeliveryMonitor,
  getFoodListingMonitor,
  getReservationMonitor,
  getUser,
  getUsers,
  verifyUser,
};
