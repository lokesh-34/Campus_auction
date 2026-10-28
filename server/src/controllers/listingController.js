import { Bid, Listing, Sale, SavedSearch } from '../models/index.js';
import { createNotification } from '../services/notificationService.js';
import { deleteCloudinaryImage } from '../services/cloudinaryService.js';
import { emitAuctionUpdate } from '../sockets/socketManager.js';

export async function createListing(req, res, next) {
  try {
    const seller = req.user;
    const {
      title,
      category,
      description,
      condition,
      startingPricePaise,
      minBidIncrementPaise,
      closingAt,
      images,
      pickupPoint,
      sellerPhone,
    } = req.body;

    const resolvedPickupPoint =
      pickupPoint?.trim() ||
      seller.pickupPoint?.trim() ||
      'Campus Central Library / Student Activity Center';
    const resolvedSellerPhone =
      sellerPhone?.trim() ||
      seller.phoneNumber?.trim() ||
      '';

    const listing = await Listing.create({
      sellerId: seller._id,
      title,
      category,
      description,
      condition,
      startingPricePaise,
      minBidIncrementPaise,
      currentPricePaise: startingPricePaise,
      closingAt: new Date(closingAt),
      images: images || [],
      pickupPoint: resolvedPickupPoint,
      sellerPhone: resolvedSellerPhone,
      bidCount: 0,
      status: 'ACTIVE',
    });

    // Check matching saved searches in background
    SavedSearch.find({
      notifyEnabled: true,
      userId: { $ne: seller._id },
      $or: [{ category }, { category: null }],
    })
      .then((savedSearches) => {
        for (const search of savedSearches) {
          if (search.maxPricePaise && startingPricePaise > search.maxPricePaise) {
            continue;
          }
          if (search.condition && condition !== search.condition) {
            continue;
          }
          if (search.keyword && !title.toLowerCase().includes(search.keyword.toLowerCase())) {
            continue;
          }

          createNotification({
            recipientId: search.userId.toString(),
            type: 'SAVED_SEARCH_MATCH',
            listingId: listing._id.toString(),
            message: `New item matching your search: "${listing.title}" listed in ${listing.category}. Starting at ₹${listing.startingPricePaise / 100}.`,
            data: { listingId: listing._id },
            eventKey: `saved_search_${search._id}_${listing._id}`,
          });
        }
      })
      .catch((err) => console.error('Saved search alert error:', err));

    res.status(201).json({
      success: true,
      data: listing,
    });
  } catch (err) {
    next(err);
  }
}

export async function getListings(req, res, next) {
  try {
    const {
      q,
      category,
      condition,
      minPrice,
      maxPrice,
      status = 'ACTIVE',
      sortBy = 'closingSoon',
      page = 1,
      limit = 12,
    } = req.query;

    const filter = {};

    if (status !== 'ALL') {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    if (condition) {
      filter.condition = condition;
    }

    if (minPrice != null || maxPrice != null) {
      filter.currentPricePaise = {};
      if (minPrice != null) filter.currentPricePaise.$gte = Number(minPrice);
      if (maxPrice != null) filter.currentPricePaise.$lte = Number(maxPrice);
    }

    if (q && q.trim()) {
      filter.$text = { $search: q.trim() };
    }

    // Never list seller's own products in the marketplace catalog for buying
    if (req.user && req.query.excludeOwn !== false) {
      filter.sellerId = { $ne: req.user._id };
    }

    let sort = {};
    if (sortBy === 'closingSoon') {
      sort = { closingAt: 1 };
    } else if (sortBy === 'priceAsc') {
      sort = { currentPricePaise: 1 };
    } else if (sortBy === 'priceDesc') {
      sort = { currentPricePaise: -1 };
    } else if (sortBy === 'newest') {
      sort = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    const [listings, totalCount] = await Promise.all([
      Listing.find(filter)
        .populate('sellerId', 'displayName stats profileImage')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Listing.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        listings,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getListingById(req, res, next) {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate('sellerId', 'displayName stats profileImage');

    if (!listing) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Listing not found', code: 'NOT_FOUND' },
      });
    }

    // Public bid history (immutable, privacy-safe: masks sensitive internal details)
    const bidHistory = await Bid.find({ listingId: listing._id })
      .populate('bidderId', 'displayName')
      .sort({ createdAt: -1 })
      .limit(30);

    const safeBids = bidHistory.map((b) => ({
      id: b._id,
      amountPaise: b.amountPaise,
      source: b.source,
      createdAt: b.createdAt,
      bidderName: b.bidderId ? b.bidderId.displayName : 'Campus Bidder',
    }));

    res.json({
      success: true,
      data: {
        listing,
        bidHistory: safeBids,
        minNextBidPaise:
          listing.bidCount === 0
            ? listing.startingPricePaise
            : listing.currentPricePaise + listing.minBidIncrementPaise,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateListing(req, res, next) {
  try {
    const { id } = req.params;
    const seller = req.user;

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Listing not found', code: 'NOT_FOUND' },
      });
    }

    if (listing.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller can edit this listing', code: 'FORBIDDEN' },
      });
    }

    if (listing.status === 'CLOSED' || listing.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Cannot edit closed or cancelled auctions', code: 'INVALID_STATUS' },
      });
    }

    const {
      title,
      description,
      condition,
      images,
      startingPricePaise,
      minBidIncrementPaise,
      pickupPoint,
      sellerPhone,
    } = req.body;

    // Price and condition modification rules:
    // If bids have NOT started yet (bidCount === 0), seller can freely edit starting price and condition!
    if (listing.bidCount === 0) {
      if (startingPricePaise != null && startingPricePaise >= 100) {
        listing.startingPricePaise = startingPricePaise;
        listing.currentPricePaise = startingPricePaise; // sync current price
      }
      if (minBidIncrementPaise != null && minBidIncrementPaise >= 100) {
        listing.minBidIncrementPaise = minBidIncrementPaise;
      }
      if (condition) listing.condition = condition;
    } else {
      // If bids have started, protect active bidders from price or condition tampering
      if (startingPricePaise != null && startingPricePaise !== listing.startingPricePaise) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'Starting price cannot be modified once bidding has started.',
            code: 'BIDS_EXIST',
          },
        });
      }
      if (condition && condition !== listing.condition) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'Condition cannot be modified once bidding has started.',
            code: 'BIDS_EXIST',
          },
        });
      }
    }

    if (title) listing.title = title;
    if (description) listing.description = description;
    if (pickupPoint) listing.pickupPoint = pickupPoint;
    if (sellerPhone != null) listing.sellerPhone = sellerPhone;

    // Handle image updates and cleanup obsolete images
    if (images) {
      const oldPublicIds = listing.images.map((img) => img.publicId);
      const newPublicIds = images.map((img) => img.publicId);
      const removedIds = oldPublicIds.filter((pid) => !newPublicIds.includes(pid));

      listing.images = images;

      // Clean up orphaned images asynchronously
      for (const pid of removedIds) {
        deleteCloudinaryImage(pid).catch((e) => console.error('Cloudinary cleanup error:', e));
      }
    }

    await listing.save();

    // Broadcast live update to any viewing buyers/bidders
    emitAuctionUpdate(listing._id.toString(), 'auction:updated', {
      listingId: listing._id,
      title: listing.title,
      description: listing.description,
      currentPricePaise: listing.currentPricePaise,
      startingPricePaise: listing.startingPricePaise,
      pickupPoint: listing.pickupPoint,
      sellerPhone: listing.sellerPhone,
    });

    res.json({
      success: true,
      data: listing,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelListing(req, res, next) {
  try {
    const { id } = req.params;
    const seller = req.user;
    const { reason } = req.body;

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Listing not found', code: 'NOT_FOUND' },
      });
    }

    if (listing.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller can cancel this listing', code: 'FORBIDDEN' },
      });
    }

    if (listing.status === 'CLOSED' || listing.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Auction is already closed or cancelled', code: 'INVALID_STATUS' },
      });
    }

    listing.status = 'CANCELLED';
    listing.cancellationReason = reason;
    await listing.save();

    // If an associated Sale record exists, update its status as well
    await Sale.findOneAndUpdate(
      { listingId: listing._id },
      { $set: { outcome: 'SELLER_CANCELLED', cancellationReason: reason } }
    );

    // If bids exist, notify the leading bidder
    if (listing.leadingBidderId) {
      createNotification({
        recipientId: listing.leadingBidderId.toString(),
        type: 'SALE_CANCELLED',
        listingId: listing._id.toString(),
        message: `Auction for "${listing.title}" was cancelled by the seller. Reason: ${reason}`,
        eventKey: `cancelled_${listing._id}_${Date.now()}`,
      });
    }

    // Broadcast auction cancellation live to all viewing clients
    emitAuctionUpdate(listing._id.toString(), 'auction:closed', {
      listingId: listing._id,
      status: 'CANCELLED',
      cancellationReason: reason,
    });

    res.json({
      success: true,
      data: listing,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyListings(req, res, next) {
  try {
    const seller = req.user;
    const listings = await Listing.find({ sellerId: seller._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: listings,
    });
  } catch (err) {
    next(err);
  }
}
