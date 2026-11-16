const FoodListing = require('../models/FoodListing');
const Reservation = require('../models/Reservation');
const {
  app,
  auth,
  clearTestDatabase,
  connectTestDatabase,
  createAccount,
  createListing,
  disconnectTestDatabase,
  request,
} = require('./helpers.cjs');

beforeAll(connectTestDatabase);
afterAll(disconnectTestDatabase);
beforeEach(clearTestDatabase);

describe('reservation inventory transactions', () => {
  test('prevents concurrent confirmations from allocating the same food twice', async () => {
    const provider = await createAccount('provider');
    const ngoA = await createAccount('ngo');
    const ngoB = await createAccount('ngo');
    const listing = await createListing(provider, { quantity: 10 });

    const [requestA, requestB] = await Promise.all([
      request(app)
        .post('/api/reservations')
        .set(auth(ngoA.token))
        .send({
          foodListingId: listing._id,
          requestedQuantity: 7,
          collectionMethod: 'self_pickup',
        }),
      request(app)
        .post('/api/reservations')
        .set(auth(ngoB.token))
        .send({
          foodListingId: listing._id,
          requestedQuantity: 7,
          collectionMethod: 'self_pickup',
        }),
    ]);
    expect(requestA.status).toBe(201);
    expect(requestB.status).toBe(201);

    const confirmations = await Promise.all([
      request(app)
        .patch(`/api/reservations/${requestA.body.data.reservation._id}/confirm`)
        .set(auth(provider.token))
        .send({ approvedQuantity: 7 }),
      request(app)
        .patch(`/api/reservations/${requestB.body.data.reservation._id}/confirm`)
        .set(auth(provider.token))
        .send({ approvedQuantity: 7 }),
    ]);
    expect(confirmations.map(({ status }) => status).sort()).toEqual([200, 409]);

    const storedListing = await FoodListing.findById(listing._id).lean();
    expect(storedListing.quantity - storedListing.availableQuantity).toBe(7);
    expect(storedListing.availableQuantity).toBe(3);

    const reservations = await Reservation.find({ foodListing: listing._id }).lean();
    expect(reservations.filter(({ status }) => status === 'confirmed')).toHaveLength(1);
    expect(reservations.filter(({ status }) => status === 'pending')).toHaveLength(1);

    const providerReservations = await request(app)
      .get('/api/reservations')
      .set(auth(provider.token));
    expect(providerReservations.status).toBe(200);
    expect(providerReservations.body.data.reservations).toHaveLength(2);
  });

  test('rejects unauthorized reservations and leaves pending or rejected requests unallocated', async () => {
    const provider = await createAccount('provider');
    const ngo = await createAccount('ngo');
    const volunteer = await createAccount('volunteer');
    const listing = await createListing(provider, { quantity: 8 });

    const unauthorized = await request(app)
      .post('/api/reservations')
      .set(auth(volunteer.token))
      .send({
        foodListingId: listing._id,
        requestedQuantity: 2,
        collectionMethod: 'self_pickup',
      });
    expect(unauthorized.status).toBe(403);

    const pending = await request(app)
      .post('/api/reservations')
      .set(auth(ngo.token))
      .send({
        foodListingId: listing._id,
        requestedQuantity: 4,
        collectionMethod: 'self_pickup',
      });
    expect(pending.status).toBe(201);
    const rejected = await request(app)
      .patch(`/api/reservations/${pending.body.data.reservation._id}/reject`)
      .set(auth(provider.token));
    expect(rejected.status).toBe(200);

    const storedListing = await FoodListing.findById(listing._id).lean();
    expect(storedListing.availableQuantity).toBe(8);
    expect(storedListing.status).toBe('available');
  });
});
