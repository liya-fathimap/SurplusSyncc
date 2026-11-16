const User = require('../models/User');
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

test('admin can verify organizations, deactivate accounts, and monitor platform records with pagination', async () => {
  const admin = await createAccount('admin');
  const provider = await createAccount('provider');
  const ngo = await createAccount('ngo');
  const volunteer = await createAccount('volunteer');

  await User.updateOne(
    { _id: provider.id },
    { $set: { isVerified: false, verificationStatus: 'pending' } },
  );
  await User.updateOne(
    { _id: ngo.id },
    { $set: { isVerified: false, verificationStatus: 'pending' } },
  );

  const providerQueue = await request(app)
    .get('/api/admin/users')
    .query({ role: 'provider', verificationStatus: 'pending', page: 1, limit: 1 })
    .set(auth(admin.token));
  expect(providerQueue.status).toBe(200);
  expect(providerQueue.body.data.users).toHaveLength(1);
  expect(providerQueue.body.data.pagination).toMatchObject({ page: 1, limit: 1, total: 1 });

  const approvedProvider = await request(app)
    .patch(`/api/admin/users/${provider.id}/verification`)
    .set(auth(admin.token))
    .send({ decision: 'approve' });
  expect(approvedProvider.status).toBe(200);
  expect(approvedProvider.body.data.user).toMatchObject({
    isVerified: true,
    verificationStatus: 'approved',
  });

  const rejectedNgo = await request(app)
    .patch(`/api/admin/users/${ngo.id}/verification`)
    .set(auth(admin.token))
    .send({ decision: 'reject' });
  expect(rejectedNgo.status).toBe(200);
  expect(rejectedNgo.body.data.user).toMatchObject({
    isVerified: false,
    verificationStatus: 'rejected',
  });

  const providerListing = await createListing(provider);
  const listings = await request(app)
    .get('/api/admin/listings')
    .query({ providerId: provider.id, page: 1, limit: 5 })
    .set(auth(admin.token));
  expect(listings.status).toBe(200);
  expect(listings.body.data.listings.map(({ _id }) => _id)).toContain(providerListing._id);

  const deactivated = await request(app)
    .patch(`/api/admin/users/${volunteer.id}/activation`)
    .set(auth(admin.token))
    .send({ active: false });
  expect(deactivated.status).toBe(200);
  expect(deactivated.body.data.user.isActive).toBe(false);

  const logs = await request(app)
    .get('/api/admin/activity-logs')
    .query({ page: 1, limit: 5 })
    .set(auth(admin.token));
  expect(logs.status).toBe(200);
  expect(logs.body.data.activityLogs.length).toBeGreaterThan(0);

  const providerDenied = await request(app)
    .get('/api/admin/users')
    .set(auth(provider.token));
  expect(providerDenied.status).toBe(403);

  const unauthenticated = await request(app).get('/api/admin/users');
  expect(unauthenticated.status).toBe(401);
});
