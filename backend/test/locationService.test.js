const test = require('node:test');
const assert = require('node:assert/strict');
const { getDeliveryRoute, isValidCoordinates } = require('../services/locationService');

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

test('validates GeoJSON coordinate order and limits routing to finite geographic points', () => {
  assert.equal(isValidCoordinates([-73.987, 40.758]), true);
  assert.equal(isValidCoordinates([181, 40]), false);
  assert.equal(isValidCoordinates([-73, Number.NaN]), false);
  assert.equal(isValidCoordinates([40, -73, 2]), false);
});

test('builds a GeoJSON route from OSRM without exposing service details to callers', async () => {
  let requestedUrl;
  global.fetch = async (url, options) => {
    requestedUrl = new URL(url);
    assert.ok(options.signal);
    return new Response(JSON.stringify({
      code: 'Ok',
      routes: [{
        distance: 4200,
        duration: 720,
        geometry: { type: 'LineString', coordinates: [[-73.987, 40.758], [-73.99, 40.76]] },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const route = await getDeliveryRoute([-73.987, 40.758], [-73.99, 40.76]);
  assert.equal(requestedUrl.hostname, 'router.project-osrm.org');
  assert.match(requestedUrl.pathname, /-73\.987,40\.758;-73\.99,40\.76/);
  assert.equal(route.distanceMeters, 4200);
  assert.equal(route.durationSeconds, 720);
  assert.equal(route.geometry.type, 'LineString');
});

test('surfaces OSRM network failures and no-route responses instead of returning fake directions', async () => {
  global.fetch = async () => { throw new TypeError('network unavailable'); };
  await assert.rejects(
    getDeliveryRoute([-73.987, 40.758], [-73.99, 40.76]),
    (error) => error.statusCode === 502 && /temporarily unavailable/i.test(error.message),
  );

  global.fetch = async () => new Response(JSON.stringify({ code: 'NoRoute', routes: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(
    getDeliveryRoute([-73.987, 40.758], [-73.99, 40.76]),
    (error) => error.statusCode === 502 && /no route/i.test(error.message),
  );
});
