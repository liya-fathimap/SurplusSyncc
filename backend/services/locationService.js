const OSRM_BASE_URL = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');

function isValidCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  const [longitude, latitude] = coordinates;
  return (
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  );
}

async function getDeliveryRoute(pickupCoordinates, destinationCoordinates) {
  if (!isValidCoordinates(pickupCoordinates) || !isValidCoordinates(destinationCoordinates)) {
    const error = new Error('Valid pickup and destination coordinates are required.');
    error.statusCode = 400;
    throw error;
  }

  const coordinates = [pickupCoordinates, destinationCoordinates]
    .map(([longitude, latitude]) => `${longitude},${latitude}`)
    .join(';');
  const url = new URL(`/route/v1/driving/${coordinates}`, `${OSRM_BASE_URL}/`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (cause) {
    const error = new Error('The routing service is temporarily unavailable.');
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const error = new Error('The routing service could not calculate this route.');
    error.statusCode = 502;
    throw error;
  }

  const result = await response.json();
  const route = result.routes?.[0];
  if (result.code !== 'Ok' || !route || !Array.isArray(route.geometry?.coordinates)) {
    const error = new Error('The routing service returned no route for these locations.');
    error.statusCode = 502;
    throw error;
  }

  return {
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

module.exports = { getDeliveryRoute, isValidCoordinates };
