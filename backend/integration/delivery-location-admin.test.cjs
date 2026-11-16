const http = require('node:http');
const { io: connectSocket } = require('socket.io-client');
const mongoose = require('mongoose');
const {
  app,
  auth,
  clearTestDatabase,
  connectTestDatabase,
  createAccount,
  createListing,
  disconnectTestDatabase,
  request,
  requestAndConfirm,
} = require('./helpers.cjs');
const { createSocketServer } = require('../realtime/socketServer');
const { publishDomainEvent } = require('../realtime/domainEventBus');

let httpServer;
let socketServer;
let socketUrl;
const clients = new Set();
const originalFetch = global.fetch;

function connectAuthenticatedSocket(token) {
  const socket = connectSocket(socketUrl, {
    auth: { token },
    reconnection: false,
    timeout: 5000,
  });
  clients.add(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function waitForSocketEvent(socket, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  await connectTestDatabase();
  httpServer = http.createServer(app);
  socketServer = createSocketServer(httpServer);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  socketUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

afterEach(async () => {
  for (const client of clients) client.disconnect();
  clients.clear();
  global.fetch = originalFetch;
  await clearTestDatabase();
});

afterAll(async () => {
  if (socketServer) await new Promise((resolve) => socketServer.close(resolve));
  await disconnectTestDatabase();
});

describe('delivery, locations, administration, and realtime', () => {
  test('completes pickup and delivery QR checks and records only verified impact', async () => {
    const provider = await createAccount('provider', {
      location: { type: 'Point', coordinates: [-73.987, 40.758] },
    });
    const ngo = await createAccount('ngo', {
      location: { type: 'Point', coordinates: [-73.99, 40.76] },
    });
    const volunteer = await createAccount('volunteer');
    const listing = await createListing(provider, { quantity: 10 });
    const { delivery } = await requestAndConfirm(provider, ngo, listing, {
      requestedQuantity: 2,
      approvedQuantity: 2,
    });

    const accepted = await request(app)
      .post(`/api/deliveries/${delivery._id}/accept`)
      .set(auth(volunteer.token));
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.delivery.status).toBe('accepted');

    const pickupQr = await request(app)
      .post(`/api/deliveries/${delivery._id}/verification-qr`)
      .set(auth(volunteer.token))
      .send({ stage: 'pickup' });
    expect(pickupQr.status).toBe(200);
    expect(pickupQr.body.data.verificationCode).toMatch(/^[a-f\d]{64}$/i);
    expect(pickupQr.body.data.qrCode).toMatch(/^data:image\/png;base64,/);

    const pickupVerified = await request(app)
      .post(`/api/deliveries/${delivery._id}/verify-pickup`)
      .set(auth(provider.token))
      .send({ code: pickupQr.body.data.verificationCode });
    expect(pickupVerified.status).toBe(200);
    expect(pickupVerified.body.data.delivery.status).toBe('picked_up');

    const inTransit = await request(app)
      .patch(`/api/deliveries/${delivery._id}/in-transit`)
      .set(auth(volunteer.token));
    expect(inTransit.status).toBe(200);

    const deliveryQr = await request(app)
      .post(`/api/deliveries/${delivery._id}/verification-qr`)
      .set(auth(volunteer.token))
      .send({ stage: 'delivery' });
    expect(deliveryQr.status).toBe(200);
    const completed = await request(app)
      .post(`/api/deliveries/${delivery._id}/verify-delivery`)
      .set(auth(ngo.token))
      .send({ code: deliveryQr.body.data.verificationCode });
    expect(completed.status).toBe(200);
    expect(completed.body.data.delivery.status).toBe('delivered');

    const history = await request(app)
      .get('/api/deliveries/my-deliveries')
      .set(auth(volunteer.token));
    expect(history.status).toBe(200);
    expect(history.body.data.deliveries[0].status).toBe('delivered');

    const ngoAnalytics = await request(app)
      .get('/api/analytics/overview')
      .set(auth(ngo.token));
    expect(ngoAnalytics.status).toBe(200);
    expect(ngoAnalytics.body.data.completedReservations).toBe(1);
    expect(ngoAnalytics.body.data.totalFoodQuantityCollected).toEqual([
      { unit: 'portions', quantity: 2 },
    ]);

    const invalidReplay = await request(app)
      .post(`/api/deliveries/${delivery._id}/verify-delivery`)
      .set(auth(ngo.token))
      .send({ code: deliveryQr.body.data.verificationCode });
    expect(invalidReplay.status).toBe(409);

    const unknownRoute = await request(app).get('/api/does-not-exist');
    expect(unknownRoute.status).toBe(404);
    expect(unknownRoute.body.success).toBe(false);
  });

  test('filters nearby locations by distance and limits provider details to verified organizations', async () => {
    const admin = await createAccount('admin');
    const provider = await createAccount('provider', {
      organizationName: 'Nearby Verified Provider',
      location: { type: 'Point', coordinates: [-73.987, 40.758] },
    });
    const ngo = await createAccount('ngo', {
      location: { type: 'Point', coordinates: [-73.99, 40.76] },
    });
    await createListing(provider);

    const nearbyListings = await request(app)
      .get('/api/locations/nearby-listings')
      .query({ longitude: -73.99, latitude: 40.76, radiusMeters: 10000 })
      .set(auth(ngo.token));
    expect(nearbyListings.status).toBe(200);
    expect(nearbyListings.body.data.listings).toHaveLength(1);
    expect(nearbyListings.body.data.listings[0].distanceMeters).toBeGreaterThan(0);

    const nearbyProviders = await request(app)
      .get('/api/locations/nearby-providers')
      .query({ longitude: -73.99, latitude: 40.76 })
      .set(auth(ngo.token));
    expect(nearbyProviders.status).toBe(200);
    expect(nearbyProviders.body.data.providers[0].organizationName).toBe('Nearby Verified Provider');
    expect(nearbyProviders.body.data.providers[0].email).toBeUndefined();
    expect(nearbyProviders.body.data.providers[0].address).toBeUndefined();

    const forbidden = await request(app)
      .get('/api/locations/nearby-providers')
      .query({ longitude: -73.99, latitude: 40.76 })
      .set(auth(provider.token));
    expect(forbidden.status).toBe(403);

    const invalidCoordinates = await request(app)
      .get('/api/locations/nearby-listings')
      .query({ longitude: 200, latitude: 40.76 })
      .set(auth(ngo.token));
    expect(invalidCoordinates.status).toBe(400);

    const adminNearbyNgos = await request(app)
      .get('/api/locations/nearby-ngos')
      .query({ longitude: -73.99, latitude: 40.76 })
      .set(auth(admin.token));
    expect(adminNearbyNgos.status).toBe(200);
    expect(adminNearbyNgos.body.data.ngos).toHaveLength(1);
  });

  test('authorizes delivery route access and returns only backend-calculated OSRM route data', async () => {
    const provider = await createAccount('provider');
    const ngo = await createAccount('ngo', {
      location: { type: 'Point', coordinates: [-73.99, 40.76] },
    });
    const otherNgo = await createAccount('ngo');
    const volunteer = await createAccount('volunteer');
    const listing = await createListing(provider);
    const { delivery } = await requestAndConfirm(provider, ngo, listing);

    const accepted = await request(app)
      .post(`/api/deliveries/${delivery._id}/accept`)
      .set(auth(volunteer.token));
    expect(accepted.status).toBe(200);

    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
      code: 'Ok',
      routes: [{
        distance: 4200,
        duration: 720,
        geometry: {
          type: 'LineString',
          coordinates: [[-73.987, 40.758], [-73.99, 40.76]],
        },
      }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const route = await request(app)
      .get(`/api/locations/deliveries/${delivery._id}/route`)
      .set(auth(volunteer.token));
    expect(route.status).toBe(200);
    expect(route.body.data.route.distanceMeters).toBe(4200);
    expect(route.body.data.route.geometry.coordinates).toHaveLength(2);
    expect(fetchCalls).toBe(1);

    const deniedRoute = await request(app)
      .get(`/api/locations/deliveries/${delivery._id}/route`)
      .set(auth(otherNgo.token));
    expect(deniedRoute.status).toBe(404);

    const noCoordinatesNgo = await createAccount('ngo');
    const missingDestination = await request(app)
      .get(`/api/locations/deliveries/${delivery._id}/route`)
      .set(auth(noCoordinatesNgo.token));
    expect(missingDestination.status).toBe(404);
  });

  test('scopes realtime events to authenticated user rooms and deactivation revokes sockets', async () => {
    const admin = await createAccount('admin');
    const provider = await createAccount('provider');
    const ngo = await createAccount('ngo');
    const providerSocket = await connectAuthenticatedSocket(provider.token);
    const ngoSocket = await connectAuthenticatedSocket(ngo.token);
    const providerNotification = waitForSocketEvent(providerSocket, 'notification:new');
    const providerDisconnect = new Promise((resolve) => providerSocket.once('disconnect', resolve));
    const ngoNotification = new Promise((resolve) => {
      ngoSocket.once('notification:new', () => resolve(true));
      setTimeout(() => resolve(false), 250);
    });

    publishDomainEvent('notification:new', {
      recipientId: provider.id,
      notification: {
        _id: new mongoose.Types.ObjectId(),
        title: 'Private test notification',
        message: 'Visible only to this provider.',
        type: 'reservation_requested',
        isRead: false,
        createdAt: new Date(),
        recipient: 'must-not-be-emitted',
      },
    });

    const notification = await providerNotification;
    expect(await ngoNotification).toBe(false);
    expect(notification.title).toBe('Private test notification');
    expect(notification.recipient).toBeUndefined();

    const adminUsers = await request(app)
      .get('/api/admin/users')
      .set(auth(admin.token));
    expect(adminUsers.status).toBe(200);
    const forbiddenUsers = await request(app)
      .get('/api/admin/users')
      .set(auth(provider.token));
    expect(forbiddenUsers.status).toBe(403);

    const revokedEvent = waitForSocketEvent(providerSocket, 'auth:revoked');
    const revoked = await request(app)
      .patch(`/api/admin/users/${provider.id}/activation`)
      .set(auth(admin.token))
      .send({ active: false });
    expect(revoked.status).toBe(200);
    await revokedEvent;

    await providerDisconnect;
    expect(providerSocket.connected).toBe(false);

    const unauthorizedSocket = connectSocket(socketUrl, {
      auth: { token: 'not-a-valid-token' },
      reconnection: false,
      timeout: 5000,
    });
    clients.add(unauthorizedSocket);
    await expect(new Promise((resolve, reject) => {
      unauthorizedSocket.once('connect', resolve);
      unauthorizedSocket.once('connect_error', reject);
    })).rejects.toThrow(/invalid or expired/i);
    expect(ngoSocket.connected).toBe(true);
  });
});
