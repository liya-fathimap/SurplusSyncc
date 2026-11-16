const {
  app,
  auth,
  clearTestDatabase,
  connectTestDatabase,
  createAccount,
  disconnectTestDatabase,
  listingPayload,
  request,
} = require('./helpers.cjs');

beforeAll(connectTestDatabase);
afterAll(disconnectTestDatabase);
beforeEach(clearTestDatabase);

describe('authentication and provider listing API', () => {
  test('registers, authenticates, enforces roles, and persists listing CRUD', async () => {
    const email = `provider-${Date.now()}@example.test`;
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Integration Provider',
      email,
      password: 'Test-password-123!',
      role: 'provider',
      organizationName: 'Test Food Bank',
    });
    expect(registration.status).toBe(201);
    expect(registration.body.data.user.password).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({
      email,
      password: 'Test-password-123!',
    });
    expect(login.status).toBe(200);
    const providerToken = login.body.data.token;
    const providerId = login.body.data.user._id;

    const me = await request(app).get('/api/auth/me').set(auth(providerToken));
    expect(me.status).toBe(200);
    expect(me.body.data.user._id).toBe(providerId);
    expect(me.body.data.user.password).toBeUndefined();

    const denied = await request(app).post('/api/listings').send(listingPayload());
    expect(denied.status).toBe(401);

    const volunteer = await createAccount('volunteer');
    const roleDenied = await request(app)
      .post('/api/listings')
      .set(auth(volunteer.token))
      .send(listingPayload());
    expect(roleDenied.status).toBe(403);

    const created = await request(app)
      .post('/api/listings')
      .set(auth(providerToken))
      .send(listingPayload());
    expect(created.status).toBe(201);
    const listingId = created.body.data.listing._id;
    expect(created.body.data.listing.provider).toBe(providerId);

    const readBack = await request(app)
      .get('/api/listings/my-listings')
      .set(auth(providerToken));
    expect(readBack.status).toBe(200);
    expect(readBack.body.data.listings.map(({ _id }) => _id)).toContain(listingId);

    const updated = await request(app)
      .put(`/api/listings/${listingId}`)
      .set(auth(providerToken))
      .send({ title: 'Updated integration meal', quantity: 12 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.listing.title).toBe('Updated integration meal');
    expect(updated.body.data.listing.availableQuantity).toBe(12);

    const cancelled = await request(app)
      .delete(`/api/listings/${listingId}`)
      .set(auth(providerToken));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.listing.status).toBe('cancelled');

    const persisted = await request(app)
      .get(`/api/listings/my-listings/${listingId}`)
      .set(auth(providerToken));
    expect(persisted.body.data.listing.status).toBe('cancelled');

    const publicAdminRegistration = await request(app).post('/api/auth/register').send({
      name: 'Public Admin',
      email: `admin-${Date.now()}@example.test`,
      password: 'Test-password-123!',
      role: 'admin',
    });
    expect(publicAdminRegistration.status).toBe(400);
  });

  test('rejects invalid credentials and malformed listing data with useful status codes', async () => {
    await createAccount('provider');
    const invalidLogin = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.test',
      password: 'wrong-password',
    });
    expect(invalidLogin.status).toBe(401);

    const provider = await createAccount('provider');
    const invalidListing = await request(app)
      .post('/api/listings')
      .set(auth(provider.token))
      .send(listingPayload({
        quantity: -2,
        location: { type: 'Point', coordinates: [200, 95] },
      }));
    expect(invalidListing.status).toBe(400);
  });
});
