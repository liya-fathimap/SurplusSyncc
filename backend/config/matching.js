const DEFAULT_WEIGHTS = {
  distance: 30,
  quantity: 25,
  category: 20,
  deadline: 15,
  verification: 10,
};

const weightEnvironmentVariables = {
  distance: 'MATCH_WEIGHT_DISTANCE',
  quantity: 'MATCH_WEIGHT_QUANTITY',
  category: 'MATCH_WEIGHT_CATEGORY',
  deadline: 'MATCH_WEIGHT_DEADLINE',
  verification: 'MATCH_WEIGHT_VERIFICATION',
};

function readNumber(environmentVariable, defaultValue) {
  const value = process.env[environmentVariable];
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${environmentVariable} must be a finite number.`);
  }

  return parsedValue;
}

function resolveMatchingConfig(overrides = {}) {
  const weights = { ...DEFAULT_WEIGHTS };

  for (const [factor, environmentVariable] of Object.entries(weightEnvironmentVariables)) {
    weights[factor] = readNumber(environmentVariable, weights[factor]);
  }

  for (const [factor, weight] of Object.entries(overrides.weights || {})) {
    if (!Object.prototype.hasOwnProperty.call(weights, factor)) {
      throw new Error(`Unknown NGO matching weight: ${factor}.`);
    }
    weights[factor] = weight;
  }

  for (const [factor, weight] of Object.entries(weights)) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`NGO matching weight "${factor}" must be a non-negative number.`);
    }
  }

  const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) {
    throw new Error('At least one NGO matching weight must be greater than zero.');
  }

  const normalizedWeights = Object.fromEntries(
    Object.entries(weights).map(([factor, weight]) => [factor, (weight / totalWeight) * 100]),
  );

  const config = {
    maxDistanceKm: readNumber('MATCH_MAX_DISTANCE_KM', 50),
    averageSpeedKmh: readNumber('MATCH_AVERAGE_SPEED_KMH', 30),
    roadDistanceFactor: readNumber('MATCH_ROAD_DISTANCE_FACTOR', 1.3),
    collectionBufferMinutes: readNumber('MATCH_COLLECTION_BUFFER_MINUTES', 15),
    deadlineScoreHorizonMinutes: readNumber('MATCH_DEADLINE_SCORE_HORIZON_MINUTES', 360),
    ...overrides,
    weights: normalizedWeights,
  };

  for (const key of [
    'maxDistanceKm',
    'averageSpeedKmh',
    'roadDistanceFactor',
    'deadlineScoreHorizonMinutes',
  ]) {
    if (!Number.isFinite(config[key]) || config[key] <= 0) {
      throw new Error(`NGO matching configuration "${key}" must be greater than zero.`);
    }
  }

  if (!Number.isFinite(config.collectionBufferMinutes) || config.collectionBufferMinutes < 0) {
    throw new Error('NGO collection buffer must be a non-negative number.');
  }

  return config;
}

module.exports = { DEFAULT_WEIGHTS, resolveMatchingConfig };
