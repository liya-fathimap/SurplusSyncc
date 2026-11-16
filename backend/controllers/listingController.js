const { matchedData } = require('express-validator');
const ActivityLog = require('../models/ActivityLog');
const FoodListing = require('../models/FoodListing');

const publicListingStatuses = ['available', 'partially_reserved', 'fully_reserved'];
const activeListingStatuses = ['available', 'partially_reserved'];
const sortOptions = {
  deadline_asc: { collectionDeadline: 1, _id: 1 },
  deadline_desc: { collectionDeadline: -1, _id: -1 },
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
};

function sendValidationError(res, error) {
  return res.status(400).json({
    success: false,
    message: 'Listing data is invalid.',
    errors: Object.values(error.errors).map((fieldError) => ({
      field: fieldError.path,
      message: fieldError.message,
    })),
  });
}

function sendNotFound(res) {
  return res.status(404).json({
    success: false,
    message: 'Food listing not found.',
  });
}

function buildPagination(input) {
  const page = input.page || 1;
  const limit = input.limit || 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: sortOptions[input.sort] || sortOptions.newest,
  };
}

function addDeadlineFilters(filter, input) {
  if (input.deadlineAfter || input.deadlineBefore) {
    filter.collectionDeadline = filter.collectionDeadline || {};
    if (input.deadlineAfter) {
      const currentAfter = filter.collectionDeadline.$gt;
      filter.collectionDeadline.$gt =
        currentAfter && currentAfter > input.deadlineAfter
          ? currentAfter
          : input.deadlineAfter;
    }
    if (input.deadlineBefore) {
      const currentBefore = filter.collectionDeadline.$lt;
      filter.collectionDeadline.$lt =
        currentBefore && currentBefore < input.deadlineBefore
          ? currentBefore
          : input.deadlineBefore;
    }
  }
}

function addCategoryFilter(filter, category) {
  if (category) {
    const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.foodCategory = { $regex: `^${escapedCategory}$`, $options: 'i' };
  }
}

function serializeProviderListing(listing) {
  const result = listing.toObject ? listing.toObject() : listing;

  if (
    result.collectionDeadline <= new Date() &&
    publicListingStatuses.includes(result.status)
  ) {
    result.status = 'expired';
  }

  return result;
}

async function createListing(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });
  const now = new Date();

  if (input.collectionDeadline <= now) {
    return res.status(400).json({
      success: false,
      message: 'Collection deadline must be in the future.',
    });
  }

  if (input.collectionDeadline <= input.preparedAt) {
    return res.status(400).json({
      success: false,
      message: 'Collection deadline must be after preparation time.',
    });
  }

  try {
    const listing = new FoodListing({
      ...input,
      provider: req.user._id,
      availableQuantity: input.quantity,
      status: 'available',
    });

    await listing.save();
    await ActivityLog.create({
      actor: req.user._id,
      action: 'food_listing.created',
      entityType: 'FoodListing',
      entityId: listing._id,
      details: {
        title: listing.title,
        quantity: listing.quantity,
        foodCategory: listing.foodCategory,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Food listing created successfully.',
      data: { listing },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return sendValidationError(res, error);
    }
    return next(error);
  }
}

async function getListings(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip, sort } = buildPagination(input);
  const filter = {
    status: {
      $in: input.availability === 'false' ? ['fully_reserved'] : activeListingStatuses,
    },
    collectionDeadline: { $gt: new Date() },
  };

  if (input.availability === 'false') {
    filter.availableQuantity = 0;
  } else {
    filter.availableQuantity = { $gt: 0 };
    if (input.minQuantity !== undefined) {
      filter.availableQuantity.$gte = input.minQuantity;
    }
    if (input.maxQuantity !== undefined) {
      filter.availableQuantity.$lte = input.maxQuantity;
    }
  }

  addCategoryFilter(filter, input.category);
  addDeadlineFilters(filter, input);

  try {
    const [listings, total] = await Promise.all([
      FoodListing.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      FoodListing.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Food listings retrieved successfully.',
      data: {
        listings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getListingById(req, res, next) {
  try {
    const listing = await FoodListing.findOne({
      _id: req.params.id,
      status: { $in: publicListingStatuses },
      collectionDeadline: { $gt: new Date() },
    }).lean();

    if (!listing) {
      return sendNotFound(res);
    }

    return res.status(200).json({
      success: true,
      message: 'Food listing retrieved successfully.',
      data: { listing },
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyListings(req, res, next) {
  const input = matchedData(req, { locations: ['query'] });
  const { page, limit, skip, sort } = buildPagination(input);
  const filter = { provider: req.user._id };
  const now = new Date();

  if (input.status === 'expired') {
    filter.$or = [
      { status: 'expired' },
      {
        status: { $in: publicListingStatuses },
        collectionDeadline: { $lte: now },
      },
    ];
  } else if (input.status) {
    filter.status = input.status;
    if (publicListingStatuses.includes(input.status)) {
      filter.collectionDeadline = { $gt: now };
    }
  }

  if (input.availability) {
    filter.$and = [
      {
        status: {
          $in: input.availability === 'false' ? ['fully_reserved'] : activeListingStatuses,
        },
        availableQuantity: input.availability === 'false' ? 0 : { $gt: 0 },
        collectionDeadline: { $gt: now },
      },
    ];
  }

  addDeadlineFilters(filter, input);
  addCategoryFilter(filter, input.category);

  try {
    const [listings, total] = await Promise.all([
      FoodListing.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      FoodListing.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Provider listings retrieved successfully.',
      data: {
        listings: listings.map(serializeProviderListing),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyListingById(req, res, next) {
  try {
    const listing = await FoodListing.findOne({
      _id: req.params.id,
      provider: req.user._id,
    }).lean();

    if (!listing) {
      return sendNotFound(res);
    }

    return res.status(200).json({
      success: true,
      message: 'Provider listing retrieved successfully.',
      data: { listing: serializeProviderListing(listing) },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateListing(req, res, next) {
  const input = matchedData(req, { locations: ['body'] });

  if (Object.keys(input).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one editable listing field is required.',
    });
  }

  try {
    const listing = await FoodListing.findOne({
      _id: req.params.id,
      provider: req.user._id,
    });

    if (!listing) {
      return sendNotFound(res);
    }

    if (
      listing.status === 'cancelled' ||
      listing.status === 'expired' ||
      listing.collectionDeadline <= new Date()
    ) {
      return res.status(409).json({
        success: false,
        message: 'Expired or cancelled listings cannot be edited.',
      });
    }

    const preparedAt = input.preparedAt || listing.preparedAt;
    const collectionDeadline = input.collectionDeadline || listing.collectionDeadline;
    if (collectionDeadline <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Collection deadline must be in the future.',
      });
    }
    if (collectionDeadline <= preparedAt) {
      return res.status(400).json({
        success: false,
        message: 'Collection deadline must be after preparation time.',
      });
    }

    const reservedQuantity = listing.quantity - listing.availableQuantity;
    const newQuantity = input.quantity === undefined ? listing.quantity : input.quantity;
    if (newQuantity < reservedQuantity) {
      return res.status(409).json({
        success: false,
        message: 'Total quantity cannot be reduced below the reserved quantity.',
        data: { reservedQuantity },
      });
    }

    const previousQuantity = listing.quantity;
    for (const [field, value] of Object.entries(input)) {
      listing[field] = value;
    }
    listing.availableQuantity = newQuantity - reservedQuantity;

    if (listing.status !== 'draft') {
      if (listing.availableQuantity === 0) {
        listing.status = 'fully_reserved';
      } else if (reservedQuantity > 0) {
        listing.status = 'partially_reserved';
      } else {
        listing.status = 'available';
      }
    }

    await listing.save();
    await ActivityLog.create({
      actor: req.user._id,
      action: 'food_listing.updated',
      entityType: 'FoodListing',
      entityId: listing._id,
      details: {
        changedFields: Object.keys(input),
        previousQuantity,
        quantity: listing.quantity,
        availableQuantity: listing.availableQuantity,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Food listing updated successfully.',
      data: { listing },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return sendValidationError(res, error);
    }
    if (error.name === 'VersionError') {
      return res.status(409).json({
        success: false,
        message: 'Listing changed concurrently. Reload it and retry.',
      });
    }
    return next(error);
  }
}

async function deleteListing(req, res, next) {
  try {
    const listing = await FoodListing.findOne({
      _id: req.params.id,
      provider: req.user._id,
    });

    if (!listing) {
      return sendNotFound(res);
    }

    if (listing.status === 'cancelled') {
      return res.status(409).json({
        success: false,
        message: 'Food listing is already cancelled.',
      });
    }

    const reservedQuantity = listing.quantity - listing.availableQuantity;
    if (reservedQuantity > 0) {
      return res.status(409).json({
        success: false,
        message: 'A listing with reserved food cannot be cancelled.',
        data: { reservedQuantity },
      });
    }

    const previousStatus = listing.status;
    listing.status = 'cancelled';
    await listing.save();
    await ActivityLog.create({
      actor: req.user._id,
      action: 'food_listing.cancelled',
      entityType: 'FoodListing',
      entityId: listing._id,
      details: { previousStatus },
    });

    return res.status(200).json({
      success: true,
      message: 'Food listing cancelled successfully.',
      data: { listing },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return sendValidationError(res, error);
    }
    if (error.name === 'VersionError') {
      return res.status(409).json({
        success: false,
        message: 'Listing changed concurrently. Reload it and retry.',
      });
    }
    return next(error);
  }
}

module.exports = {
  createListing,
  deleteListing,
  getListingById,
  getListings,
  getMyListingById,
  getMyListings,
  updateListing,
};
