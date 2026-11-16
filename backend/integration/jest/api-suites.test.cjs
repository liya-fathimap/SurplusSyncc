const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('runs Supertest API flows against an isolated MongoDB replica set', () => {
  const testFiles = [
    'integration/auth-listings.test.cjs',
    'integration/reservations.test.cjs',
    'integration/delivery-location-admin.test.cjs',
    'integration/admin.test.cjs',
  ];
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-concurrency=1', ...testFiles],
    {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      env: { ...process.env, SURPLUS_SYNC_NODE_TEST: '1' },
      timeout: 240000,
    },
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
});
