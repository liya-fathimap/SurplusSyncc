const { matchedData } = require('express-validator');
const {
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
} = require('../services/deliveryService');

function sendDeliveryError(res, error) {
  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
  });
}

function operation(handler, message, statusCode = 200) {
  return async function runOperation(req, res, next) {
    try {
      const data = await handler(req);
      return res.status(statusCode).json({ success: true, message, data });
    } catch (error) {
      if (error instanceof DeliveryError) {
        return sendDeliveryError(res, error);
      }
      return next(error);
    }
  };
}

const getAvailable = operation(
  async () => ({ deliveries: await getAvailableTasks() }),
  'Available delivery tasks retrieved successfully.',
);

const getMine = operation(
  async (req) => ({
    deliveries: await getMyDeliveries({
      userId: req.user._id,
      role: req.user.role,
    }),
  }),
  'Your deliveries retrieved successfully.',
);

const assign = operation(
  async (req) => {
    const input = matchedData(req, { locations: ['body'] });
    const delivery = await assignDelivery({
      deliveryId: req.params.id,
      providerId: req.user._id,
      volunteerId: input.volunteerId,
    });
    return { delivery };
  },
  'Volunteer assigned successfully.',
);

const accept = operation(
  async (req) => ({
    delivery: await acceptDelivery({
      deliveryId: req.params.id,
      volunteerId: req.user._id,
    }),
  }),
  'Delivery task accepted successfully.',
);

async function requestVerificationQr(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });
  try {
    const result = await issueVerificationQr({
      deliveryId: req.params.id,
      userId: req.user._id,
      role: req.user.role,
      stage: input.stage,
    });
    res.set('Cache-Control', 'no-store, private');
    return res.status(200).json({
      success: true,
      message: `${input.stage} verification QR generated successfully.`,
      data: result,
    });
  } catch (error) {
    if (error instanceof DeliveryError) {
      return sendDeliveryError(res, error);
    }
    return next(error);
  }
}

const pickup = operation(
  async (req) => {
    const input = matchedData(req, { locations: ['body'] });
    return {
      delivery: await verifyPickup({
        deliveryId: req.params.id,
        providerId: req.user._id,
        code: input.code,
      }),
    };
  },
  'Pickup verified successfully.',
);

const inTransit = operation(
  async (req) => ({
    delivery: await markInTransit({
      deliveryId: req.params.id,
      volunteerId: req.user._id,
    }),
  }),
  'Delivery marked in transit.',
);

const delivered = operation(
  async (req) => {
    const input = matchedData(req, { locations: ['body'] });
    return {
      delivery: await verifyDelivery({
        deliveryId: req.params.id,
        ngoId: req.user._id,
        code: input.code,
      }),
    };
  },
  'Delivery verified and completed successfully.',
);

const fail = operation(
  async (req) => {
    const input = matchedData(req, { locations: ['body'] });
    return {
      delivery: await failDelivery({
        deliveryId: req.params.id,
        volunteerId: req.user._id,
        reason: input.reason,
      }),
    };
  },
  'Delivery marked as failed.',
);

const cancel = operation(
  async (req) => ({
    delivery: await cancelDelivery({
      deliveryId: req.params.id,
      actorId: req.user._id,
      role: req.user.role,
    }),
  }),
  'Delivery cancelled successfully.',
);

module.exports = {
  accept,
  assign,
  cancel,
  delivered,
  fail,
  getAvailable,
  getMine,
  inTransit,
  pickup,
  requestVerificationQr,
};
