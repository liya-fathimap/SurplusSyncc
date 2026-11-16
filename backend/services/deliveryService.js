const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const ActivityLog = require('../models/ActivityLog');
const Delivery = require('../models/Delivery');
const FoodListing = require('../models/FoodListing');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const { createNotification } = require('./notificationService');
const { restoreReservationInventory } = require('./reservationService');
const { publishDomainEvent } = require('../realtime/domainEventBus');

class DeliveryError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'DeliveryError';
    this.statusCode = statusCode;
  }
}

function assertMongoId(id, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new DeliveryError(`${fieldName} must be a valid MongoDB id.`, 400);
  }
}

function hashCode(code) {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

function codeMatches(code, storedHash) {
  if (typeof code !== 'string' || !/^[a-f\d]{64}$/i.test(code)) {
    return false;
  }

  if (typeof storedHash !== 'string' || !/^[a-f\d]{64}$/i.test(storedHash)) {
    return false;
  }

  const actualHash = Buffer.from(hashCode(code), 'hex');
  const expectedHash = Buffer.from(storedHash, 'hex');
  return timingSafeEqual(actualHash, expectedHash);
}

function notificationPayload(notification) {
  return typeof notification?.toObject === 'function'
    ? notification.toObject()
    : notification;
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

async function recordActivity(session, actor, action, delivery, details = {}) {
  await ActivityLog.create(
    [
      {
        actor,
        action,
        entityType: 'Delivery',
        entityId: delivery._id,
        details: {
          reservation: delivery.reservation,
          ...details,
        },
      },
    ],
    { session },
  );
}

async function loadDeliveryContext(session, deliveryId, includeHashes = false) {
  let deliveryQuery = Delivery.findById(deliveryId);
  if (includeHashes) {
    deliveryQuery = deliveryQuery.select('+pickupCodeHash +deliveryCodeHash');
  }
  const delivery = await deliveryQuery.session(session);

  if (!delivery) {
    throw new DeliveryError('Delivery not found.', 404);
  }

  const reservation = await Reservation.findById(delivery.reservation).session(session);
  if (!reservation) {
    throw new DeliveryError('Reservation for this delivery was not found.', 409);
  }

  const listing = await FoodListing.findById(reservation.foodListing).session(session);
  if (!listing) {
    throw new DeliveryError('Food listing for this delivery was not found.', 409);
  }

  return { delivery, listing, reservation };
}

function assertCollectionIsCurrent(listing) {
  if (
    listing.collectionDeadline <= new Date() ||
    listing.status === 'expired' ||
    listing.status === 'cancelled'
  ) {
    throw new DeliveryError('The collection deadline has passed or the listing is unavailable.', 409);
  }
}

async function getAvailableTasks() {
  const now = new Date();
  const deliveries = await Delivery.find({
    status: 'pending',
    collectionMethod: 'volunteer_delivery',
  })
    .sort({ createdAt: 1 })
    .populate({
      path: 'reservation',
      match: { status: 'confirmed', collectionMethod: 'volunteer_delivery' },
      select: 'foodListing ngo approvedQuantity collectionMethod',
      populate: [
        {
          path: 'foodListing',
          match: {
            collectionDeadline: { $gt: now },
            status: { $nin: ['expired', 'cancelled'] },
          },
          select: 'title foodCategory quantity unit pickupAddress location collectionDeadline status',
        },
        {
          path: 'ngo',
          select: 'name organizationName phone',
        },
      ],
    })
    .lean();

  return deliveries.filter(
    (delivery) => delivery.reservation && delivery.reservation.foodListing,
  );
}

async function getMyDeliveries({ userId, role }) {
  let filter;
  if (role === 'volunteer') {
    filter = { volunteer: userId };
  } else if (role === 'ngo') {
    const reservationIds = await Reservation.distinct('_id', { ngo: userId });
    filter = { reservation: { $in: reservationIds } };
  } else if (role === 'provider') {
    const listingIds = await FoodListing.distinct('_id', { provider: userId });
    const reservationIds = await Reservation.distinct('_id', {
      foodListing: { $in: listingIds },
    });
    filter = { reservation: { $in: reservationIds } };
  } else {
    throw new DeliveryError('This role cannot view delivery records.', 403);
  }

  return Delivery.find(filter)
    .sort({ createdAt: -1 })
    .populate({
      path: 'reservation',
      select: 'foodListing ngo approvedQuantity collectionMethod status',
      populate: [
        {
          path: 'foodListing',
          select: 'title foodCategory quantity unit pickupAddress location collectionDeadline',
        },
        { path: 'ngo', select: 'name organizationName phone' },
      ],
    })
    .populate('volunteer', 'name phone')
    .lean();
}

async function assignDelivery({ deliveryId, providerId, volunteerId }) {
  assertMongoId(deliveryId, 'Delivery id');
  assertMongoId(volunteerId, 'Volunteer id');

  return withTransaction(async (session, afterCommit) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(
      session,
      deliveryId,
    );

    if (String(listing.provider) !== String(providerId)) {
      throw new DeliveryError('Delivery not found.', 404);
    }

    if (
      reservation.status !== 'confirmed' ||
      reservation.collectionMethod !== 'volunteer_delivery' ||
      delivery.collectionMethod !== 'volunteer_delivery'
    ) {
      throw new DeliveryError('Only confirmed volunteer-delivery reservations can be assigned.', 409);
    }
    assertCollectionIsCurrent(listing);

    const volunteer = await User.findOne({
      _id: volunteerId,
      role: 'volunteer',
      isActive: true,
    })
      .select('_id')
      .session(session);

    if (!volunteer) {
      throw new DeliveryError('Active volunteer not found.', 404);
    }

    const now = new Date();
    const assignedDelivery = await Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        status: 'pending',
        volunteer: null,
        collectionMethod: 'volunteer_delivery',
      },
      {
        $set: {
          volunteer: volunteerId,
          status: 'assigned',
          assignedAt: now,
        },
      },
      { new: true, session, runValidators: true },
    );

    if (!assignedDelivery) {
      throw new DeliveryError('This delivery task has already been assigned or accepted.', 409);
    }

    await recordActivity(session, providerId, 'delivery.assigned', assignedDelivery, {
      volunteer: volunteerId,
    });
    const notification = await createNotification({
      recipient: volunteerId,
      title: 'Delivery task assigned',
      message: 'A provider assigned you a confirmed food delivery task.',
      type: 'delivery_assigned',
      eventKey: `delivery:${assignedDelivery._id}:assigned:${volunteerId}`,
      session,
    });
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(volunteerId),
        notification: notificationPayload(notification),
      });
      publishDomainEvent('delivery:updated', {
        deliveryId: String(assignedDelivery._id),
        status: assignedDelivery.status,
        providerId: String(providerId),
        ngoId: String(reservation.ngo),
        volunteerId: String(volunteerId),
      });
    });
    return assignedDelivery;
  });
}

async function acceptDelivery({ deliveryId, volunteerId }) {
  assertMongoId(deliveryId, 'Delivery id');

  return withTransaction(async (session, afterCommit) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(
      session,
      deliveryId,
    );

    if (
      reservation.status !== 'confirmed' ||
      reservation.collectionMethod !== 'volunteer_delivery' ||
      delivery.collectionMethod !== 'volunteer_delivery'
    ) {
      throw new DeliveryError('Only confirmed volunteer-delivery tasks can be accepted.', 409);
    }
    assertCollectionIsCurrent(listing);

    let filter;
    const now = new Date();
    const updates = {
      $set: {
        volunteer: volunteerId,
        status: 'accepted',
        acceptedAt: now,
      },
    };

    if (delivery.status === 'pending' && !delivery.volunteer) {
      filter = { _id: deliveryId, status: 'pending', volunteer: null };
      updates.$set.assignedAt = now;
    } else if (
      delivery.status === 'assigned' &&
      String(delivery.volunteer) === String(volunteerId)
    ) {
      filter = {
        _id: deliveryId,
        status: 'assigned',
        volunteer: volunteerId,
      };
    } else {
      throw new DeliveryError('This delivery task is not available to you.', 409);
    }

    const acceptedDelivery = await Delivery.findOneAndUpdate(filter, updates, {
      new: true,
      session,
      runValidators: true,
    });

    if (!acceptedDelivery) {
      throw new DeliveryError('Another volunteer has already accepted this task.', 409);
    }

    await recordActivity(session, volunteerId, 'delivery.accepted', acceptedDelivery);
    afterCommit(() => {
      publishDomainEvent('delivery:updated', {
        deliveryId: String(acceptedDelivery._id),
        status: acceptedDelivery.status,
        providerId: String(listing.provider),
        ngoId: String(reservation.ngo),
        volunteerId: String(volunteerId),
      });
    });
    return acceptedDelivery;
  });
}

async function issueVerificationQr({ deliveryId, userId, role, stage }) {
  assertMongoId(deliveryId, 'Delivery id');
  if (!['pickup', 'delivery'].includes(stage)) {
    throw new DeliveryError('Verification stage must be pickup or delivery.', 400);
  }

  const code = randomBytes(32).toString('hex');
  const codeHash = hashCode(code);
  const qrPayload = JSON.stringify({
    type: 'surplussync.delivery-verification',
    deliveryId: String(deliveryId),
    stage,
    code,
  });
  const qrCode = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'Q',
    margin: 1,
    type: 'image/png',
  });

  return withTransaction(async (session) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(
      session,
      deliveryId,
      true,
    );
    if (reservation.status !== 'confirmed') {
      throw new DeliveryError('Verification codes are available only for confirmed reservations.', 409);
    }
    const ownsReservation = String(reservation.ngo) === String(userId);
    const isAssignedVolunteer = String(delivery.volunteer) === String(userId);

    if (stage === 'pickup') {
      if (
        delivery.collectionMethod === 'self_pickup' &&
        role === 'ngo' &&
        ownsReservation &&
        delivery.status === 'pending'
      ) {
        delivery.pickupCodeHash = codeHash;
      } else if (
        delivery.collectionMethod === 'volunteer_delivery' &&
        role === 'volunteer' &&
        isAssignedVolunteer &&
        delivery.status === 'accepted'
      ) {
        delivery.pickupCodeHash = codeHash;
      } else {
        throw new DeliveryError('You are not authorized to obtain this pickup QR code.', 403);
      }
    } else if (
      delivery.collectionMethod === 'volunteer_delivery' &&
      role === 'volunteer' &&
      isAssignedVolunteer &&
      ['accepted', 'picked_up', 'in_transit'].includes(delivery.status)
    ) {
      delivery.deliveryCodeHash = codeHash;
    } else {
      throw new DeliveryError('You are not authorized to obtain this delivery QR code.', 403);
    }

    await delivery.save({ session });
    await recordActivity(session, userId, 'delivery.qr_issued', delivery, { stage });
    return { stage, verificationCode: code, qrCode };
  });
}

async function verifyPickup({ deliveryId, providerId, code }) {
  assertMongoId(deliveryId, 'Delivery id');

  return withTransaction(async (session, afterCommit) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(
      session,
      deliveryId,
      true,
    );

    if (String(listing.provider) !== String(providerId)) {
      throw new DeliveryError('Delivery not found.', 404);
    }
    if (reservation.status !== 'confirmed') {
      throw new DeliveryError('Only confirmed reservations can be picked up.', 409);
    }
    assertCollectionIsCurrent(listing);

    const requiredStatus =
      delivery.collectionMethod === 'self_pickup' ? 'pending' : 'accepted';
    if (delivery.status !== requiredStatus) {
      throw new DeliveryError('Delivery is not in a state that can be picked up.', 409);
    }
    if (!codeMatches(code, delivery.pickupCodeHash)) {
      throw new DeliveryError('Pickup QR code is invalid, expired, or already used.', 400);
    }

    const now = new Date();
    const pickedUpDelivery = await Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        status: requiredStatus,
        pickupCodeHash: delivery.pickupCodeHash,
      },
      {
        $set: { status: 'picked_up', pickupTime: now },
        $unset: { pickupCodeHash: 1 },
      },
      { new: true, session, runValidators: true },
    );

    if (!pickedUpDelivery) {
      throw new DeliveryError('Pickup QR code has already been used.', 409);
    }

    let notification;
    if (delivery.collectionMethod === 'self_pickup') {
      reservation.status = 'completed';
      reservation.completedAt = now;
      await reservation.save({ session });
      notification = await createNotification({
        recipient: reservation.ngo,
        title: 'Pickup completed',
        message: 'Your self-pickup was verified by the provider.',
        type: 'delivery_completed',
        eventKey: `delivery:${pickedUpDelivery._id}:completed:${reservation.ngo}`,
        session,
      });
    }

    await recordActivity(session, providerId, 'delivery.picked_up', pickedUpDelivery, {
      collectionMethod: delivery.collectionMethod,
    });
    afterCommit(() => {
      if (notification) {
        publishDomainEvent('notification:new', {
          recipientId: String(reservation.ngo),
          notification: notificationPayload(notification),
        });
      }
      publishDomainEvent('delivery:updated', {
        deliveryId: String(pickedUpDelivery._id),
        status: pickedUpDelivery.status,
        providerId: String(listing.provider),
        ngoId: String(reservation.ngo),
        volunteerId: delivery.volunteer ? String(delivery.volunteer) : null,
      });
    });
    return pickedUpDelivery;
  });
}

async function markInTransit({ deliveryId, volunteerId }) {
  assertMongoId(deliveryId, 'Delivery id');

  return withTransaction(async (session, afterCommit) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(session, deliveryId);
    if (
      delivery.collectionMethod !== 'volunteer_delivery' ||
      String(delivery.volunteer) !== String(volunteerId)
    ) {
      throw new DeliveryError('Delivery not found.', 404);
    }
    if (reservation.status !== 'confirmed') {
      throw new DeliveryError('Only confirmed reservations can be moved in transit.', 409);
    }
    if (delivery.status !== 'picked_up') {
      throw new DeliveryError('Only picked-up deliveries can be marked in transit.', 409);
    }

    const updatedDelivery = await Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        status: 'picked_up',
        volunteer: volunteerId,
      },
      { $set: { status: 'in_transit', inTransitAt: new Date() } },
      { new: true, session, runValidators: true },
    );

    if (!updatedDelivery) {
      throw new DeliveryError('Delivery state changed; reload and try again.', 409);
    }

    await recordActivity(session, volunteerId, 'delivery.in_transit', updatedDelivery);
    afterCommit(() => {
      publishDomainEvent('delivery:updated', {
        deliveryId: String(updatedDelivery._id),
        status: updatedDelivery.status,
        providerId: String(listing.provider),
        ngoId: String(reservation.ngo),
        volunteerId: String(volunteerId),
      });
    });
    return updatedDelivery;
  });
}

async function verifyDelivery({ deliveryId, ngoId, code }) {
  assertMongoId(deliveryId, 'Delivery id');

  return withTransaction(async (session, afterCommit) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(
      session,
      deliveryId,
      true,
    );

    if (
      delivery.collectionMethod !== 'volunteer_delivery' ||
      String(reservation.ngo) !== String(ngoId)
    ) {
      throw new DeliveryError('Delivery not found.', 404);
    }
    if (reservation.status !== 'confirmed' || delivery.status !== 'in_transit') {
      throw new DeliveryError('Only in-transit deliveries can be verified as delivered.', 409);
    }
    if (!codeMatches(code, delivery.deliveryCodeHash)) {
      throw new DeliveryError('Delivery QR code is invalid, expired, or already used.', 400);
    }

    const now = new Date();
    const delivered = await Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        status: 'in_transit',
        deliveryCodeHash: delivery.deliveryCodeHash,
      },
      {
        $set: { status: 'delivered', deliveredAt: now },
        $unset: { deliveryCodeHash: 1 },
      },
      { new: true, session, runValidators: true },
    );

    if (!delivered) {
      throw new DeliveryError('Delivery QR code has already been used.', 409);
    }

    reservation.status = 'completed';
    reservation.completedAt = now;
    await reservation.save({ session });
    await recordActivity(session, ngoId, 'delivery.delivered', delivered);
    const ngoNotification = await createNotification({
      recipient: ngoId,
      title: 'Delivery completed',
      message: 'The delivery has been verified and completed.',
      type: 'delivery_completed',
      eventKey: `delivery:${delivered._id}:completed:${ngoId}`,
      session,
    });
    const providerNotification = await createNotification({
      recipient: listing.provider,
      title: 'Food delivery completed',
      message: 'The NGO verified receipt of the reserved food.',
      type: 'delivery_completed',
      eventKey: `delivery:${delivered._id}:completed:${listing.provider}`,
      session,
    });
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(ngoId),
        notification: notificationPayload(ngoNotification),
      });
      publishDomainEvent('notification:new', {
        recipientId: String(listing.provider),
        notification: notificationPayload(providerNotification),
      });
      publishDomainEvent('delivery:updated', {
        deliveryId: String(delivered._id),
        status: delivered.status,
        providerId: String(listing.provider),
        ngoId: String(ngoId),
        volunteerId: delivery.volunteer ? String(delivery.volunteer) : null,
      });
    });
    return delivered;
  });
}

async function failDelivery({ deliveryId, volunteerId, reason }) {
  assertMongoId(deliveryId, 'Delivery id');

  return withTransaction(async (session, afterCommit) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(
      session,
      deliveryId,
      true,
    );
    if (
      delivery.collectionMethod !== 'volunteer_delivery' ||
      String(delivery.volunteer) !== String(volunteerId)
    ) {
      throw new DeliveryError('Delivery not found.', 404);
    }
    if (reservation.status !== 'confirmed') {
      throw new DeliveryError('Only confirmed reservations can be marked failed.', 409);
    }
    if (!['assigned', 'accepted', 'picked_up', 'in_transit'].includes(delivery.status)) {
      throw new DeliveryError('This delivery cannot be marked failed.', 409);
    }

    const now = new Date();
    const failedDelivery = await Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        status: delivery.status,
        volunteer: volunteerId,
      },
      {
        $set: { status: 'failed', failedAt: now, failureReason: reason },
        $unset: { pickupCodeHash: 1, deliveryCodeHash: 1 },
      },
      { new: true, session, runValidators: true },
    );

    if (!failedDelivery) {
      throw new DeliveryError('Delivery state changed; reload and try again.', 409);
    }

    if (delivery.pickupTime) {
      reservation.status = 'failed';
    } else {
      await restoreReservationInventory(session, reservation);
      reservation.status = 'cancelled';
    }
    await reservation.save({ session });
    await recordActivity(session, volunteerId, 'delivery.failed', failedDelivery, {
      reason,
      reservationStatus: reservation.status,
    });
    await ActivityLog.create(
      [
        {
          actor: volunteerId,
          action:
            reservation.status === 'failed'
              ? 'reservation.delivery_failed'
              : 'reservation.cancelled',
          entityType: 'Reservation',
          entityId: reservation._id,
          details: { delivery: failedDelivery._id, reason },
        },
      ],
      { session },
    );
    const ngoNotification = await createNotification({
      recipient: reservation.ngo,
      title: 'Delivery could not be completed',
      message:
        reservation.status === 'failed'
          ? 'The delivery failed after pickup. Contact the provider to resolve the issue.'
          : 'The delivery failed before pickup and the reservation was cancelled.',
      type: 'delivery_failed',
      eventKey: `delivery:${failedDelivery._id}:failed:${reservation.ngo}`,
      session,
    });
    const providerNotification = await createNotification({
      recipient: listing.provider,
      title: 'Delivery failed',
      message:
        reservation.status === 'failed'
          ? 'The delivery failed after pickup.'
          : 'The delivery failed before pickup and inventory was restored.',
      type: 'delivery_failed',
      eventKey: `delivery:${failedDelivery._id}:failed:${listing.provider}`,
      session,
    });
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(reservation.ngo),
        notification: notificationPayload(ngoNotification),
      });
      publishDomainEvent('notification:new', {
        recipientId: String(listing.provider),
        notification: notificationPayload(providerNotification),
      });
      publishDomainEvent('delivery:updated', {
        deliveryId: String(failedDelivery._id),
        status: failedDelivery.status,
        providerId: String(listing.provider),
        ngoId: String(reservation.ngo),
        volunteerId: String(volunteerId),
      });
    });
    return failedDelivery;
  });
}

async function cancelDelivery({ deliveryId, actorId, role }) {
  assertMongoId(deliveryId, 'Delivery id');

  return withTransaction(async (session, afterCommit) => {
    const { delivery, listing, reservation } = await loadDeliveryContext(
      session,
      deliveryId,
      true,
    );

    const authorized =
      (role === 'provider' && String(listing.provider) === String(actorId)) ||
      (role === 'ngo' && String(reservation.ngo) === String(actorId));
    if (!authorized) {
      throw new DeliveryError('Delivery not found.', 404);
    }
    if (reservation.status !== 'confirmed') {
      throw new DeliveryError('Only confirmed reservations can be cancelled.', 409);
    }
    if (!['pending', 'assigned', 'accepted'].includes(delivery.status)) {
      throw new DeliveryError('A delivery cannot be cancelled after pickup.', 409);
    }

    const now = new Date();
    const cancelledDelivery = await Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        status: delivery.status,
        pickupTime: null,
      },
      {
        $set: { status: 'cancelled', cancelledAt: now },
        $unset: { pickupCodeHash: 1, deliveryCodeHash: 1 },
      },
      { new: true, session, runValidators: true },
    );

    if (!cancelledDelivery) {
      throw new DeliveryError('Delivery state changed; reload and try again.', 409);
    }

    await restoreReservationInventory(session, reservation);
    reservation.status = 'cancelled';
    await reservation.save({ session });
    await recordActivity(session, actorId, 'delivery.cancelled', cancelledDelivery);
    await ActivityLog.create(
      [
        {
          actor: actorId,
          action: 'reservation.cancelled',
          entityType: 'Reservation',
          entityId: reservation._id,
          details: { delivery: cancelledDelivery._id },
        },
      ],
      { session },
    );
    const ngoNotification = await createNotification({
      recipient: reservation.ngo,
      title: 'Delivery cancelled',
      message: 'The provider or NGO cancelled the delivery before pickup.',
      type: 'delivery_cancelled',
      eventKey: `delivery:${cancelledDelivery._id}:cancelled:${reservation.ngo}`,
      session,
    });
    const providerNotification = await createNotification({
      recipient: listing.provider,
      title: 'Delivery cancelled',
      message: 'The reservation delivery was cancelled before pickup.',
      type: 'delivery_cancelled',
      eventKey: `delivery:${cancelledDelivery._id}:cancelled:${listing.provider}`,
      session,
    });
    afterCommit(() => {
      publishDomainEvent('notification:new', {
        recipientId: String(reservation.ngo),
        notification: notificationPayload(ngoNotification),
      });
      publishDomainEvent('notification:new', {
        recipientId: String(listing.provider),
        notification: notificationPayload(providerNotification),
      });
      publishDomainEvent('delivery:updated', {
        deliveryId: String(cancelledDelivery._id),
        status: cancelledDelivery.status,
        providerId: String(listing.provider),
        ngoId: String(reservation.ngo),
        volunteerId: delivery.volunteer ? String(delivery.volunteer) : null,
      });
    });
    return cancelledDelivery;
  });
}

module.exports = {
  DeliveryError,
  acceptDelivery,
  assignDelivery,
  cancelDelivery,
  failDelivery,
  getAvailableTasks,
  getMyDeliveries,
  issueVerificationQr,
  markInTransit,
  verifyDelivery,
  verifyPickup,
};
