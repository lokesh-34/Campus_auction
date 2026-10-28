import { AutoBid, Bid, Listing } from '../models/index.js';
import { configureAutoBid, placeManualBid } from '../services/biddingService.js';

export async function placeBid(req, res, next) {
  try {
    const { id: listingId } = req.params;
    const bidderId = req.user._id;
    const { amountPaise } = req.body;

    const result = await placeManualBid({
      listingId,
      bidderId,
      amountPaise,
    });

    res.status(201).json({
      success: true,
      data: {
        acceptedBid: {
          id: result.acceptedBid._id,
          amountPaise: result.acceptedBid.amountPaise,
          createdAt: result.acceptedBid.createdAt,
        },
        listing: {
          id: result.listing._id,
          currentPricePaise: result.listing.currentPricePaise,
          leadingBidderId: result.listing.leadingBidderId,
          bidCount: result.listing.bidCount,
          closingAt: result.listing.closingAt,
          status: result.listing.status,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function setAutoBid(req, res, next) {
  try {
    const { id: listingId } = req.params;
    const bidderId = req.user._id;
    const { maxAmountPaise } = req.body;

    const result = await configureAutoBid({
      listingId,
      bidderId,
      maxAmountPaise,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyAutoBid(req, res, next) {
  try {
    const { id: listingId } = req.params;
    const bidderId = req.user._id;

    const config = await AutoBid.findOne({ listingId, bidderId });

    if (!config) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        id: config._id,
        listingId: config.listingId,
        maxAmountPaise: config.maxAmountPaise, // Returned strictly to the owner
        enabled: config.enabled,
        updatedAt: config.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function disableAutoBid(req, res, next) {
  try {
    const { id: listingId } = req.params;
    const bidderId = req.user._id;

    const config = await AutoBid.findOneAndUpdate(
      { listingId, bidderId },
      { enabled: false },
      { new: true }
    );

    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBidHistory(req, res, next) {
  try {
    const { id: listingId } = req.params;
    const bids = await Bid.find({ listingId })
      .populate('bidderId', 'displayName')
      .sort({ createdAt: -1 })
      .limit(50);

    const safeBids = bids.map((b) => ({
      id: b._id,
      amountPaise: b.amountPaise,
      source: b.source,
      isWinning: b.isWinning,
      createdAt: b.createdAt,
      bidderName: b.bidderId ? b.bidderId.displayName : 'Campus Bidder',
    }));

    res.json({
      success: true,
      data: safeBids,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyActiveBids(req, res, next) {
  try {
    const userId = req.user._id;

    // Find all listing IDs where the user has placed bids or has an active autobid
    const [bidListingIds, autoBidListingIds] = await Promise.all([
      Bid.distinct('listingId', { bidderId: userId }),
      AutoBid.distinct('listingId', { bidderId: userId, enabled: true }),
    ]);

    const allListingIds = Array.from(
      new Set([
        ...bidListingIds.map((id) => id.toString()),
        ...autoBidListingIds.map((id) => id.toString()),
      ])
    );

    if (allListingIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const now = new Date();
    // Only fetch listings that are currently active or extended and not past closing time
    const activeListings = await Listing.find({
      _id: { $in: allListingIds },
      status: { $in: ['ACTIVE', 'EXTENDED'] },
      closingAt: { $gt: now },
    })
      .populate('sellerId', 'displayName')
      .sort({ closingAt: 1 });

    if (activeListings.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const activeIds = activeListings.map((l) => l._id);

    // Aggregate user's highest bid and latest bid info per active listing
    const [userBidsAgg, autoBids] = await Promise.all([
      Bid.aggregate([
        {
          $match: {
            listingId: { $in: activeIds },
            bidderId: userId,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: '$listingId',
            myHighestBidPaise: { $max: '$amountPaise' },
            latestBidAmountPaise: { $first: '$amountPaise' },
            myBidCount: { $sum: 1 },
            latestBidCreatedAt: { $first: '$createdAt' },
          },
        },
      ]),
      AutoBid.find({
        listingId: { $in: activeIds },
        bidderId: userId,
        enabled: true,
      }),
    ]);

    const bidMap = new Map();
    userBidsAgg.forEach((b) => bidMap.set(b._id.toString(), b));

    const autoBidMap = new Map();
    autoBids.forEach((ab) => autoBidMap.set(ab.listingId.toString(), ab));

    const result = activeListings.map((listing) => {
      const listingIdStr = listing._id.toString();
      const bidInfo = bidMap.get(listingIdStr);
      const autoBid = autoBidMap.get(listingIdStr);

      const isLeading = Boolean(
        listing.leadingBidderId && listing.leadingBidderId.toString() === userId.toString()
      );

      const minNextBidPaise =
        listing.bidCount === 0
          ? listing.startingPricePaise
          : listing.currentPricePaise + (listing.minBidIncrementPaise || 5000);

      const myHighestBidPaise = bidInfo?.myHighestBidPaise || 0;

      return {
        _id: listing._id,
        listingId: listing._id,
        title: listing.title,
        category: listing.category,
        condition: listing.condition,
        images: listing.images || [],
        startingPricePaise: listing.startingPricePaise,
        currentPricePaise: listing.currentPricePaise,
        minBidIncrementPaise: listing.minBidIncrementPaise,
        minNextBidPaise,
        bidCount: listing.bidCount,
        status: listing.status,
        closingAt: listing.closingAt,
        pickupPoint: listing.pickupPoint,
        seller: listing.sellerId
          ? {
              _id: listing.sellerId._id,
              displayName: listing.sellerId.displayName,
            }
          : null,
        isLeading,
        bidStatus: isLeading ? 'LEADING' : 'OUTBID',
        myHighestBidPaise,
        myBidCount: bidInfo?.myBidCount || 0,
        latestBidCreatedAt: bidInfo?.latestBidCreatedAt || null,
        hasAutoBid: Boolean(autoBid),
        autoBidMaxPaise: autoBid?.maxAmountPaise || null,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
