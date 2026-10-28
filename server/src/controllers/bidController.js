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
