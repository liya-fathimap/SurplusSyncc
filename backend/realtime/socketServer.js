const mongoose = require('mongoose');
const { Server } = require('socket.io');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');
const { domainEventBus } = require('./domainEventBus');

function userRoom(userId) {
  return `user:${userId}`;
}

function emitToUsers(io, userIds, eventName, payload) {
  for (const userId of new Set(userIds.filter(Boolean).map(String))) {
    io.to(userRoom(userId)).emit(eventName, payload);
  }
}

function createSocketServer(httpServer) {
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });
  const domainHandlers = [];

  function onDomainEvent(eventName, handler) {
    domainEventBus.on(eventName, handler);
    domainHandlers.push([eventName, handler]);
  }

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      return next(new Error('Authentication token is required.'));
    }

    try {
      const payload = verifyAccessToken(token);
      if (
        !payload ||
        typeof payload.sub !== 'string' ||
        !mongoose.isValidObjectId(payload.sub)
      ) {
        return next(new Error('Invalid or expired authentication token.'));
      }

      const user = await User.findById(payload.sub)
        .select('_id role isActive')
        .lean();
      if (!user || !user.isActive) {
        return next(new Error('User account is unavailable.'));
      }

      socket.data.user = {
        id: String(user._id),
        role: user.role,
      };
      return next();
    } catch (error) {
      if (
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)
      ) {
        return next(new Error('Invalid or expired authentication token.'));
      }
      console.error('Socket authentication failed:', error);
      return next(new Error('Socket authentication failed.'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(userRoom(id));
    socket.join(`role:${role}`);
  });

  onDomainEvent('notification:new', ({ recipientId, notification }) => {
    if (recipientId && notification) {
      const source = typeof notification.toObject === 'function'
        ? notification.toObject()
        : notification;
      io.to(userRoom(recipientId)).emit('notification:new', {
        id: String(source._id),
        title: source.title,
        message: source.message,
        type: source.type,
        isRead: source.isRead,
        createdAt: source.createdAt,
      });
    }
  });

  onDomainEvent('reservation:requested', (event) => {
    emitToUsers(io, [event.providerId], 'reservation:updated', event);
  });

  onDomainEvent('reservation:updated', (event) => {
    emitToUsers(io, [event.providerId, event.ngoId], 'reservation:updated', event);
  });

  onDomainEvent('delivery:available', (event) => {
    io.to('role:volunteer').emit('delivery:available', event);
  });

  onDomainEvent('delivery:updated', (event) => {
    emitToUsers(
      io,
      [event.providerId, event.ngoId, event.volunteerId],
      'delivery:updated',
      event,
    );
    if (event.status !== 'pending') {
      io.to('role:volunteer').emit('delivery:updated', {
        deliveryId: event.deliveryId,
        status: event.status,
      });
    }
  });

  onDomainEvent('account:deactivated', ({ userId }) => {
    if (!userId) return;
    const room = userRoom(userId);
    io.to(room).emit('auth:revoked');
    io.in(room).disconnectSockets(true);
  });

  io.on('close', () => {
    for (const [eventName, handler] of domainHandlers) {
      domainEventBus.removeListener(eventName, handler);
    }
  });

  return io;
}

module.exports = { createSocketServer, userRoom };
