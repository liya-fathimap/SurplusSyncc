const FoodListing = require('../models/FoodListing');
const Reservation = require('../models/Reservation');
const Delivery = require('../models/Delivery');
const User = require('../models/User');

const activeListingStatuses = ['available', 'partially_reserved'];
const countStatuses = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'failed'];
const noEnvironmentalEstimate = {
  status: 'not_calculated',
  estimates: [],
  reason: 'No approved environmental conversion factors are configured.',
};

function completedReservationBasePipeline({ ngoId, providerId, since, until } = {}) {
  const stages = [
    {
      $match: {
        status: 'completed',
        approvedQuantity: { $gt: 0 },
        ...(ngoId ? { ngo: ngoId } : {}),
      },
    },
    {
      $addFields: {
        completionDate: { $ifNull: ['$completedAt', '$updatedAt'] },
      },
    },
  ];

  if (since || until) {
    const completionDate = {};
    if (since) completionDate.$gte = since;
    if (until) completionDate.$lte = until;
    stages.push({ $match: { completionDate } });
  }

  stages.push(
    {
      $lookup: {
        from: 'foodlistings',
        localField: 'foodListing',
        foreignField: '_id',
        as: 'listing',
      },
    },
    { $unwind: '$listing' },
  );

  if (providerId) {
    stages.push({ $match: { 'listing.provider': providerId } });
  }

  return stages;
}

function completedReservationPipeline({ ngoId, providerId, since, groupBy }) {
  const stages = completedReservationBasePipeline({ ngoId, providerId, since });
  stages.push(
    {
      $group: {
        _id: groupBy,
        redistributedQuantity: { $sum: '$approvedQuantity' },
        completedReservations: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  );

  return stages;
}

function quantityByUnitPipeline() {
  return [
    { $match: { status: { $ne: 'draft' } } },
    {
      $group: {
        _id: '$unit',
        quantity: { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

function providerPerformancePipeline({ providerId, now }) {
  const match = { status: { $ne: 'draft' } };
  if (providerId) {
    match.provider = providerId;
  }

  return [
    { $match: match },
    {
      $lookup: {
        from: 'reservations',
        let: { listingId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$foodListing', '$$listingId'] },
                  { $eq: ['$status', 'completed'] },
                  { $gt: [{ $ifNull: ['$approvedQuantity', 0] }, 0] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              redistributedQuantity: { $sum: '$approvedQuantity' },
              completedReservations: { $sum: 1 },
            },
          },
        ],
        as: 'completionStats',
      },
    },
    {
      $addFields: {
        completionStats: {
          $ifNull: [
            { $arrayElemAt: ['$completionStats', 0] },
            { redistributedQuantity: 0, completedReservations: 0 },
          ],
        },
        isActiveListing: {
          $and: [
            { $in: ['$status', activeListingStatuses] },
            { $gt: ['$collectionDeadline', now] },
            { $gt: ['$availableQuantity', 0] },
          ],
        },
      },
    },
    {
      $group: {
        _id: { provider: '$provider', unit: '$unit' },
        quantityListed: { $sum: '$quantity' },
        quantityRedistributed: { $sum: '$completionStats.redistributedQuantity' },
        completedReservations: { $sum: '$completionStats.completedReservations' },
        activeListings: { $sum: { $cond: ['$isActiveListing', 1, 0] } },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id.provider',
        foreignField: '_id',
        as: 'provider',
      },
    },
    {
      $unwind: {
        path: '$provider',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        providerId: '$_id.provider',
        providerName: '$provider.name',
        organizationName: '$provider.organizationName',
        unit: '$_id.unit',
        quantityListed: 1,
        quantityRedistributed: 1,
        completedReservations: 1,
        activeListings: 1,
      },
    },
    { $sort: { providerName: 1, unit: 1 } },
  ];
}

function categoryDistributionPipeline({ providerId } = {}) {
  const match = { status: { $ne: 'draft' } };
  if (providerId) {
    match.provider = providerId;
  }

  return [
    { $match: match },
    {
      $lookup: {
        from: 'reservations',
        let: { listingId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$foodListing', '$$listingId'] },
                  { $eq: ['$status', 'completed'] },
                  { $gt: [{ $ifNull: ['$approvedQuantity', 0] }, 0] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              redistributedQuantity: { $sum: '$approvedQuantity' },
              completedReservations: { $sum: 1 },
            },
          },
        ],
        as: 'completionStats',
      },
    },
    {
      $addFields: {
        completionStats: {
          $ifNull: [
            { $arrayElemAt: ['$completionStats', 0] },
            { redistributedQuantity: 0, completedReservations: 0 },
          ],
        },
      },
    },
    {
      $group: {
        _id: { category: '$foodCategory', unit: '$unit' },
        quantityListed: { $sum: '$quantity' },
        quantityRedistributed: { $sum: '$completionStats.redistributedQuantity' },
        completedReservations: { $sum: '$completionStats.completedReservations' },
      },
    },
    { $sort: { '_id.category': 1, '_id.unit': 1 } },
    {
      $project: {
        _id: 0,
        category: '$_id.category',
        unit: '$_id.unit',
        quantityListed: 1,
        quantityRedistributed: 1,
        completedReservations: 1,
      },
    },
  ];
}

function deliveryCountPipeline({ ngoId, providerId } = {}) {
  const stages = [
    { $match: { status: 'delivered' } },
    {
      $lookup: {
        from: 'reservations',
        localField: 'reservation',
        foreignField: '_id',
        as: 'reservation',
      },
    },
    { $unwind: '$reservation' },
  ];

  if (ngoId) {
    stages.push({ $match: { 'reservation.ngo': ngoId } });
  }

  if (providerId) {
    stages.push(
      {
        $lookup: {
          from: 'foodlistings',
          localField: 'reservation.foodListing',
          foreignField: '_id',
          as: 'listing',
        },
      },
      { $unwind: '$listing' },
      { $match: { 'listing.provider': providerId } },
    );
  }

  stages.push({ $count: 'successfulDeliveries' });
  return stages;
}

function getMonthStart(now, months) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
}

async function getPlatformOverview(now) {
  const [
    listedByUnit,
    redistributedByUnit,
    activeFoodListings,
    completedReservations,
    successfulDeliveryResult,
    activeProviders,
    verifiedNgos,
  ] = await Promise.all([
    FoodListing.aggregate(quantityByUnitPipeline()),
    Reservation.aggregate(
      completedReservationPipeline({ groupBy: '$listing.unit' }),
    ),
    FoodListing.countDocuments({
      status: { $in: activeListingStatuses },
      collectionDeadline: { $gt: now },
      availableQuantity: { $gt: 0 },
    }),
    Reservation.countDocuments({ status: 'completed' }),
    Delivery.aggregate(deliveryCountPipeline()),
    User.countDocuments({ role: 'provider', isActive: true }),
    User.countDocuments({ role: 'ngo', isVerified: true }),
  ]);

  return {
    totalFoodQuantityListed: listedByUnit.map(({ _id, quantity }) => ({
      unit: _id,
      quantity,
    })),
    totalFoodQuantityRedistributed: redistributedByUnit.map(
      ({ _id, redistributedQuantity }) => ({
        unit: _id,
        quantity: redistributedQuantity,
      }),
    ),
    activeFoodListings,
    completedReservations,
    successfulDeliveries: successfulDeliveryResult[0]?.successfulDeliveries || 0,
    activeProviders,
    verifiedNgos,
    environmentalImpact: noEnvironmentalEstimate,
    generatedAt: now,
  };
}

async function getProviderOverview(providerId, now) {
  const [rows, deliveryResult] = await Promise.all([
    FoodListing.aggregate(providerPerformancePipeline({ providerId, now })),
    Delivery.aggregate(deliveryCountPipeline({ providerId })),
  ]);

  return {
    totalFoodQuantityListed: rows.map((row) => ({
      unit: row.unit,
      quantity: row.quantityListed,
    })),
    totalFoodQuantityRedistributed: rows.map((row) => ({
      unit: row.unit,
      quantity: row.quantityRedistributed,
    })),
    activeFoodListings: rows.reduce((total, row) => total + row.activeListings, 0),
    completedReservations: rows.reduce(
      (total, row) => total + row.completedReservations,
      0,
    ),
    successfulDeliveries: deliveryResult[0]?.successfulDeliveries || 0,
    environmentalImpact: noEnvironmentalEstimate,
    generatedAt: now,
  };
}

async function getNgoOverview(ngoId, now) {
  const [reservationStatusRows, redistributedByUnit, collectionHistory, deliveryResult] =
    await Promise.all([
      Reservation.aggregate([
        { $match: { ngo: ngoId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Reservation.aggregate(
        completedReservationPipeline({ ngoId, groupBy: '$listing.unit' }),
      ),
      Reservation.aggregate(
        completedReservationPipeline({
          ngoId,
          since: getMonthStart(now, 12),
          until: now,
          groupBy: {
            month: {
              $dateToString: {
                format: '%Y-%m',
                date: '$completionDate',
                timezone: 'UTC',
              },
            },
            unit: '$listing.unit',
          },
        }),
      ),
      Delivery.aggregate(deliveryCountPipeline({ ngoId })),
    ]);

  const counts = Object.fromEntries(
    reservationStatusRows.map(({ _id, count }) => [_id, count]),
  );

  return {
    reservationsByStatus: countStatuses.map((status) => ({
      status,
      count: counts[status] || 0,
    })),
    completedReservations: counts.completed || 0,
    pendingReservations: counts.pending || 0,
    confirmedReservations: counts.confirmed || 0,
    totalFoodQuantityCollected: redistributedByUnit.map(
      ({ _id, redistributedQuantity }) => ({
        unit: _id,
        quantity: redistributedQuantity,
      }),
    ),
    collectionHistory: collectionHistory.map(({ _id, redistributedQuantity, completedReservations }) => ({
      month: _id.month,
      unit: _id.unit,
      quantity: redistributedQuantity,
      completedReservations,
    })),
    successfulDeliveries: deliveryResult[0]?.successfulDeliveries || 0,
    environmentalImpact: noEnvironmentalEstimate,
    generatedAt: now,
  };
}

async function getOverview({ role, userId, now = new Date() }) {
  if (role === 'admin') {
    return getPlatformOverview(now);
  }
  if (role === 'provider') {
    return getProviderOverview(userId, now);
  }
  if (role === 'ngo') {
    return getNgoOverview(userId, now);
  }
  throw new Error('Unsupported role for analytics.');
}

async function getMonthlyStatistics({ role, userId, months = 12, now = new Date() }) {
  const scope =
    role === 'provider'
      ? { providerId: userId }
      : role === 'ngo'
        ? { ngoId: userId }
        : {};
  const from = getMonthStart(now, months);
  const rows = await Reservation.aggregate(
    completedReservationPipeline({
      ...scope,
      since: from,
      until: now,
      groupBy: {
        month: {
          $dateToString: {
            format: '%Y-%m',
            date: '$completionDate',
            timezone: 'UTC',
          },
        },
        unit: '$listing.unit',
      },
    }),
  );

  return {
    months,
    from,
    through: now,
    statistics: rows.map(({ _id, redistributedQuantity, completedReservations }) => ({
      month: _id.month,
      unit: _id.unit,
      quantityRedistributed: redistributedQuantity,
      completedReservations,
    })),
    environmentalImpact: noEnvironmentalEstimate,
  };
}

async function getCategoryDistribution({ role, userId }) {
  if (role === 'ngo') {
    const rows = await Reservation.aggregate([
      ...completedReservationBasePipeline({
        ngoId: userId,
      }),
      {
        $group: {
          _id: {
            category: '$listing.foodCategory',
            unit: '$listing.unit',
          },
          quantityRedistributed: { $sum: '$approvedQuantity' },
          completedReservations: { $sum: 1 },
        },
      },
      { $sort: { '_id.category': 1, '_id.unit': 1 } },
    ]);
    return rows.map(({ _id, quantityRedistributed, completedReservations }) => ({
      category: _id.category,
      unit: _id.unit,
      quantityRedistributed,
      completedReservations,
    }));
  }

  const providerId = role === 'provider' ? userId : undefined;
  const rows = await FoodListing.aggregate(categoryDistributionPipeline({ providerId }));
  return rows.map((row) => ({
    category: row.category,
    unit: row.unit,
    quantityListed: row.quantityListed,
    quantityRedistributed: row.quantityRedistributed,
    completedReservations: row.completedReservations,
  }));
}

async function getProviderPerformance({ providerId, now = new Date() } = {}) {
  const rows = await FoodListing.aggregate(
    providerPerformancePipeline({ providerId, now }),
  );
  const providers = new Map();

  for (const row of rows) {
    const id = String(row.providerId);
    if (!providers.has(id)) {
      providers.set(id, {
        providerId: row.providerId,
        providerName: row.providerName || null,
        organizationName: row.organizationName || null,
        activeFoodListings: 0,
        completedReservations: 0,
        quantitiesByUnit: [],
      });
    }

    const provider = providers.get(id);
    provider.activeFoodListings += row.activeListings;
    provider.completedReservations += row.completedReservations;
    provider.quantitiesByUnit.push({
      unit: row.unit,
      quantityListed: row.quantityListed,
      quantityRedistributed: row.quantityRedistributed,
    });
  }

  if (providerId) {
    return providers.get(String(providerId)) || {
      providerId,
      providerName: null,
      organizationName: null,
      activeFoodListings: 0,
      completedReservations: 0,
      quantitiesByUnit: [],
    };
  }

  return [...providers.values()];
}

module.exports = {
  categoryDistributionPipeline,
  completedReservationBasePipeline,
  completedReservationPipeline,
  getCategoryDistribution,
  getMonthlyStatistics,
  getOverview,
  getProviderPerformance,
  providerPerformancePipeline,
};
