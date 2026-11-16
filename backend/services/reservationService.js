const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const Reservation = require('../models/Reservation');
const { createNotification } = require('./notificationService');
const { publishDomainEvent } = require('../realtime/domainEventBus');

const reservableListingStatuses = ['available', 'partially_reserved'];
const restorableListingStatuses = [
  'available',
  'partially_reserved',
  'fully_reserved',
];

function notificationPayload(notification) {
  return typeof notification?.toObject === 'function'
    ? notification.toObject()
    : notification;
}

class ReservationError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'ReservationError';
    this.statusCode = statusCode;
  }
}

function assertMongoId(id, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ReservationError(`${fieldName} must be a valid MongoDB id.`, 400);
  }
}

async function withTransaction(operation) {
  const session = await mongoose.startSession();
  let afterCommit = [];
  try {
    let result;
    await session.withTransaction(async () => {
      afterCommit = [];
      result = await operation(session, (callback) => afterCommit.push(callback));
    });
    for (const callback of afterCommit) {
      try {
        callback();
      } catch (error) {
        console.error('Realtime event publication failed:', error);
      }
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function logReservationActivity(session, actor, action, reservation, details = {}) {
  await ActivityLog.create(
    [
      {
        actor,
        action,
        entityType: 'Reservation',
        entityId: reservation._id,
        details: {
          foodListing: reservation.foodListing,
          ...details,
        },
      },
    ],
    { session },
  );
}

async function restoreReservationInventory(session, reservation) {
  const restoredQuantity = reservation.approvedQuantity;
  const listing = await FoodListing.findById(reservation.foodListing).session(session);

  if (!listing) {
    throw new ReservationError('Food listing for this reservation was not found.', 409);
  }

  const updatedListing = await FoodListing.findOneAndUpdate(
    {
      _id: listing._id,
      quantity: listing.quantity,
      availableQuantity: { $lte: listing.quantity - restoredQuantity },
    },
    { $inc: { availableQuantity: restoredQuantity } },
    { new: true, session },
  );

  if (!updatedListing) {
    throw new ReservationError(
      'Inventory cannot be safely restored for this reservation.',
      409,
    );
  }

  if (updatedListing.status !== 'cancelled') {
    if (
      updatedListing.status === 'expired' ||
      updatedListing.collectionDeadline <= new Date()
    ) {
      updatedListing.status = 'expired';
    } else if (restorableListingStatuses.includes(updatedListing.status)) {
      if (updatedListing.availableQuantity === 0) {
        updatedListing.status = 'fully_reserved';
      } else if (updatedListing.availableQuantity < updatedListing.quantity) {
        updatedListing.status = 'partially_reserved';
      } else {
        updatedListing.status = 'available';
      }
    }
  }

  await updatedListing.save({ session });
  return restoredQuantity;
}

async function createReservation({
  ngo,
  foodListingId,
  requestedQuantity,
  collectionMethod,
}) {
  assertMongoId(foodListingId, 'Food listing id');

  if (!ngo || ngo.role !== 'ngo' || !ngo.isActive || !ngo.isVerified) {
    throw new ReservationError('Only active, verified NGOs can request food.', 403);
  }

  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new ReservationError('Requested quantity must be greater than zero.', 400);
  }

  return withTransaction(async (session, afterCommit) => {
    const now = new Date();
    const listing = await FoodListing.findOne({
      _id: foodListingId,
      status: { $in: reservableListingStatuses },
      collectionDeadline: { $gt: now },
      availableQuantity: { $gt: 0 },
    }).session(session);

    if (!listing) {
      throw new ReservationError('Food listing is expired or unavailable.', 409);
    }

    if (requestedQuantity > listing.availableQuantity) {
      throw new ReservationError(
        'Requested quantity exceeds the currently available quantity.',
        409,
      );
    }

    const reservation = new Reservation({
      foodListing: listing._id,
      ngo: ngo._id,
      requestedQuantity,
      status: 'pending',
      collectionMethod,
    });
    await reservation.save({ session });
    await logReservationActivity(session, ngo._id, 'reservation.requested', reservation, {
      requestedQuantity,
    });
    const notification = await createNotification({
      recipient: listing.provider,
      title: 'New reservation request',
      message: `An NGO requested ${requestedQuantity} ${listing.unit} from ${listing.title}.`,
      type: 'reservation_requested',
      eventKey: `reservation:${reservation._id}:requested:${listing.provider}`,
      session,
    });
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(listing.provider),
        notification: notificationPayload(notification),
      });
      publishDomainEvent('reservation:requested', {
        reservationId: String(reservation._id),
        foodListingId: String(listing._id),
        providerId: String(listing.provider),
        ngoId: String(ngo._id),
        status: reservation.status,
      });
    });

    return reservation;
  });
}

async function findReservationForProvider(session, reservationId, providerId) {
  const reservation = await Reservation.findById(reservationId).session(session);
  if (!reservation) {
    throw new ReservationError('Reservation not found.', 404);
  }

  const listing = await FoodListing.findOne({
    _id: reservation.foodListing,
    provider: providerId,
  }).session(session);

  if (!listing) {
    throw new ReservationError('Reservation not found.', 404);
  }

  if (reservation.status !== 'pending') {
    throw new ReservationError('Only pending reservations can be confirmed or rejected.', 409);
  }

  return { listing, reservation };
}

async function confirmReservation({ reservationId, providerId, approvedQuantity }) {
  assertMongoId(reservationId, 'Reservation id');

  return withTransaction(async (session, afterCommit) => {
    const { reservation } = await findReservationForProvider(
      session,
      reservationId,
      providerId,
    );
    const quantity =
      approvedQuantity === undefined ? reservation.requestedQuantity : approvedQuantity;

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > reservation.requestedQuantity
    ) {
      throw new ReservationError(
        'Approved quantity must be greater than zero and no more than requested.',
        400,
      );
    }

    const now = new Date();
    const listing = await FoodListing.findOneAndUpdate(
      {
        _id: reservation.foodListing,
        provider: providerId,
        status: { $in: reservableListingStatuses },
        collectionDeadline: { $gt: now },
        availableQuantity: { $gte: quantity },
      },
      { $inc: { availableQuantity: -quantity } },
      { new: true, session },
    );

    if (!listing) {
      throw new ReservationError(
        'Listing is unavailable or no longer has enough inventory to confirm this reservation.',
        409,
      );
    }

    listing.status =
      listing.availableQuantity === 0 ? 'fully_reserved' : 'partially_reserved';
    await listing.save({ session });

    reservation.approvedQuantity = quantity;
    reservation.status = 'confirmed';
    reservation.confirmedAt = now;
    await reservation.save({ session });
    const delivery = new Delivery({
      reservation: reservation._id,
      collectionMethod: reservation.collectionMethod,
    });
    await delivery.save({ session });
    await logReservationActivity(
      session,
      providerId,
      'reservation.confirmed',
      reservation,
      { approvedQuantity: quantity },
    );
    await ActivityLog.create(
      [
        {
          actor: providerId,
          action: 'delivery.created',
          entityType: 'Delivery',
          entityId: delivery._id,
          details: {
            reservation: reservation._id,
            collectionMethod: delivery.collectionMethod,
          },
        },
      ],
      { session },
    );
    const notification = await createNotification({
      recipient: reservation.ngo,
      title: 'Reservation confirmed',
      message: `Your request for ${quantity} units has been confirmed.`,
      type: 'reservation_confirmed',
      eventKey: `reservation:${reservation._id}:confirmed`,
      session,
    });
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(reservation.ngo),
        notification: notificationPayload(notification),
      });
      publishDomainEvent('reservation:updated', {
        reservationId: String(reservation._id),
        foodListingId: String(listing._id),
        providerId: String(providerId),
        ngoId: String(reservation.ngo),
        status: reservation.status,
        deliveryId: String(delivery._id),
      });
      if (delivery.collectionMethod === 'volunteer_delivery') {
        publishDomainEvent('delivery:available', {
          deliveryId: String(delivery._id),
          foodListingId: String(listing._id),
          collectionDeadline: listing.collectionDeadline,
        });
      }
    });

    return reservation;
  });
}

async function rejectReservation({ reservationId, providerId }) {
  assertMongoId(reservationId, 'Reservation id');

  return withTransaction(async (session, afterCommit) => {
    const { reservation } = await findReservationForProvider(
      session,
      reservationId,
      providerId,
    );

    reservation.status = 'rejected';
    reservation.approvedQuantity = 0;
    reservation.confirmedAt = null;
    await reservation.save({ session });
    await logReservationActivity(
      session,
      providerId,
      'reservation.rejected',
      reservation,
      { requestedQuantity: reservation.requestedQuantity },
    );
    const notification = await createNotification({
      recipient: reservation.ngo,
      title: 'Reservation request rejected',
      message: 'The provider could not approve your reservation request.',
      type: 'reservation_rejected',
      eventKey: `reservation:${reservation._id}:rejected`,
      session,
    });
    const listing = await FoodListing.findById(reservation.foodListing)
      .select('provider')
      .session(session);
    if (!listing) {
      throw new ReservationError('Food listing for this reservation was not found.', 409);
    }
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(reservation.ngo),
        notification: notificationPayload(notification),
      });
      publishDomainEvent('reservation:updated', {
        reservationId: String(reservation._id),
        foodListingId: String(reservation.foodListing),
        providerId: String(listing.provider),
        ngoId: String(reservation.ngo),
        status: reservation.status,
      });
    });

    return reservation;
  });
}

async function cancelReservation({ reservationId, ngoId }) {
  assertMongoId(reservationId, 'Reservation id');

  return withTransaction(async (session, afterCommit) => {
    const reservation = await Reservation.findOne({
      _id: reservationId,
      ngo: ngoId,
    }).session(session);

    if (!reservation) {
      throw new ReservationError('Reservation not found.', 404);
    }
    const listing = await FoodListing.findById(reservation.foodListing)
      .select('provider')
      .session(session);
    if (!listing) {
      throw new ReservationError('Food listing for this reservation was not found.', 409);
    }

    if (reservation.status !== 'pending' && reservation.status !== 'confirmed') {
      throw new ReservationError('This reservation can no longer be cancelled.', 409);
    }

    let restoredQuantity = 0;
    if (reservation.status === 'confirmed') {
      const delivery = await Delivery.findOne({
        reservation: reservation._id,
      })
        .select('+pickupCodeHash +deliveryCodeHash')
        .session(session);

      if (
        delivery &&
        ['picked_up', 'in_transit', 'delivered'].includes(delivery.status)
      ) {
        throw new ReservationError(
          'A reservation cannot be cancelled after pickup; mark the delivery failed if needed.',
          409,
        );
      }

      restoredQuantity = await restoreReservationInventory(session, reservation);
      if (delivery && delivery.status !== 'cancelled') {
        delivery.status = 'cancelled';
        delivery.cancelledAt = new Date();
        delivery.pickupCodeHash = null;
        delivery.deliveryCodeHash = null;
        await delivery.save({ session });
        await ActivityLog.create(
          [
            {
              actor: ngoId,
              action: 'delivery.cancelled',
              entityType: 'Delivery',
              entityId: delivery._id,
              details: { reservation: reservation._id },
            },
          ],
          { session },
        );
      }
    }

    reservation.status = 'cancelled';
    await reservation.save({ session });
    await logReservationActivity(session, ngoId, 'reservation.cancelled', reservation, {
      restoredQuantity,
    });
    const notification = await createNotification({
      recipient: reservation.ngo,
      title: 'Reservation cancelled',
      message: 'Your reservation has been cancelled.',
      type: 'reservation_cancelled',
      eventKey: `reservation:${reservation._id}:cancelled`,
      session,
    });
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(reservation.ngo),
        notification: notificationPayload(notification),
      });
      publishDomainEvent('reservation:updated', {
        reservationId: String(reservation._id),
        foodListingId: String(reservation.foodListing),
        providerId: String(listing.provider),
        ngoId: String(reservation.ngo),
        status: reservation.status,
      });
    });

    return reservation;
  });
}

module.exports = {
  ReservationError,
  cancelReservation,
  confirmReservation,
  createReservation,
  rejectReservation,
  restoreReservationInventory,
};
