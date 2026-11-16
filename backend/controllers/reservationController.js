const { matchedData } = require('express-validator');
const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const Reservation = require('../models/Reservation');
const {
  ReservationError,
  cancelReservation,
  confirmReservation,
  createReservation,
  rejectReservation,
} = require('../services/reservationService');

function sendReservationError(res, error) {
  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
  });
}

function getPagination(input) {
  const page = input.page || 1;
  const limit = input.limit || 20;
  return { page, limit, skip: (page - 1) * limit };
}

function sendReservationList(res, message, reservations, page, limit, total) {
  return res.status(200).json({
    success: true,
    message,
    data: {
      reservations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
}

async function requestReservation(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });

  try {
    const reservation = await createReservation({
      ngo: req.user,
      foodListingId: input.foodListingId,
      requestedQuantity: input.requestedQuantity,
      collectionMethod: input.collectionMethod,
    });

    return res.status(201).json({
      success: true,
      message: 'Reservation request submitted successfully.',
      data: { reservation },
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      return sendReservationError(res, error);
    }
    return next(error);
  }
}

async function getMyReservations(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip } = getPagination(input);
  const filter = { ngo: req.user._id };
  if (input.status) {
    filter.status = input.status;
  }

  try {
    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'foodListing',
          select: 'title foodCategory quantity availableQuantity unit collectionDeadline preparedAt storageCondition allergens pickupAddress provider status',
          populate: {
            path: 'provider',
            select: 'name organizationName phone',
          },
        })
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    return sendReservationList(
      res,
      'Your reservations were retrieved successfully.',
      reservations,
      page,
      limit,
      total,
    );
  } catch (error) {
    return next(error);
  }
}

async function getMyReservationById(req, res, next) {
  try {
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      ngo: req.user._id,
    })
      .populate({
        path: 'foodListing',
        select: 'title description foodCategory quantity availableQuantity unit collectionDeadline preparedAt storageCondition allergens pickupAddress provider status location',
        populate: {
          path: 'provider',
          select: 'name organizationName phone',
        },
      })
      .lean();

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reservation retrieved successfully.',
      data: { reservation },
    });
  } catch (error) {
    return next(error);
  }
}

async function getProviderReservations(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip } = getPagination(input);

  try {
    const listingIds = await FoodListing.distinct('_id', { provider: req.user._id });
    const filter = { foodListing: { $in: listingIds } };
    if (input.foodListingId) {
      filter.foodListing.$in = filter.foodListing.$in.filter(
        (listingId) => String(listingId) === input.foodListingId,
      );
    }
    if (input.status) {
      filter.status = input.status;
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(
          'foodListing',
          'title foodCategory quantity availableQuantity unit collectionDeadline status',
        )
        .populate('ngo', 'name organizationName email phone isVerified')
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    return sendReservationList(
      res,
      'Listing reservation requests were retrieved successfully.',
      reservations,
      page,
      limit,
      total,
    );
  } catch (error) {
    return next(error);
  }
}

async function confirm(req, res, next) {
  const input = matchedData(req, { locations: ['body', 'params'] });

  try {
    const reservation = await confirmReservation({
      reservationId: req.params.id,
      providerId: req.user._id,
      approvedQuantity: input.approvedQuantity,
    });
    const delivery = await Delivery.findOne({ reservation: reservation._id });
    if (!delivery) {
      return next(new Error('Confirmed reservation is missing its delivery record.'));
    }

    return res.status(200).json({
      success: true,
      message: 'Reservation confirmed successfully.',
      data: { reservation, delivery },
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      return sendReservationError(res, error);
    }
    return next(error);
  }
}

async function reject(req, res, next) {
  try {
    const reservation = await rejectReservation({
      reservationId: req.params.id,
      providerId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Reservation rejected successfully.',
      data: { reservation },
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      return sendReservationError(res, error);
    }
    return next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const reservation = await cancelReservation({
      reservationId: req.params.id,
      ngoId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Reservation cancelled successfully.',
      data: { reservation },
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      return sendReservationError(res, error);
    }
    return next(error);
  }
}

module.exports = {
  cancel,
  confirm,
  getMyReservationById,
  getMyReservations,
  getProviderReservations,
  reject,
  requestReservation,
};
