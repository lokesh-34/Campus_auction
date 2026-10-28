import mongoose from 'mongoose';
import { withTransaction } from '../config/db.js';
import { AutoBid, Bid, Listing } from '../models/index.js';
import { emitAuctionUpdate } from '../sockets/socketManager.js';
import { createNotification } from './notificationService.js';

/**
 * Validates whether an auction can currently accept bids.
 * @param {import('../models/Listing.js').IListing} listing
 * @param {Date} now
 */
function assertAuctionEligible(listing, now) {
  if (!['ACTIVE', 'EXTENDED'].includes(listing.status)) {
    const error = new Error(`Cannot bid on auction with status: ${listing.status}`);
    error.statusCode = 400;
    throw error;
  }

  if (new Date(listing.closingAt) <= now) {
    const error = new Error('This auction has already closed.');
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Checks for anti-sniping extension (within 30 seconds of closingAt)
 * and returns new closingAt and whether extended.
 * @param {Date} closingAt
 * @param {Date} bidTime
 */
function evaluateAntiSniping(closingAt, bidTime) {
  const msRemaining = new Date(closingAt).getTime() - bidTime.getTime();
  if (msRemaining <= 30000 && msRemaining > 0) {
    // Extend closing time to 60 seconds from the bid acceptance time
    const newClosingAt = new Date(bidTime.getTime() + 60000);
    return { shouldExtend: true, newClosingAt };
  }
  return { shouldExtend: false, newClosingAt: closingAt };
}

/**
 * Authoritative manual bid processor with transaction safety and anti-sniping extension.
 * @param {Object} params
 * @param {string} params.listingId
 * @param {string} params.bidderId
 * @param {number} params.amountPaise
 */
export async function placeManualBid({ listingId, bidderId, amountPaise }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    const err = new Error('Bid amount must be a positive integer in paise.');
    err.statusCode = 400;
    throw err;
  }

  let broadcastPayload = null;
  let previousLeaderId = null;

  const result = await withTransaction(async (session) => {
    const now = new Date();

    // Fetch listing with transaction session
    const listing = await Listing.findById(listingId).session(session);
    if (!listing) {
      const err = new Error('Listing not found.');
      err.statusCode = 404;
      throw err;
    }

    // Prohibit self-bidding
    if (listing.sellerId.toString() === bidderId.toString()) {
      const err = new Error('Sellers cannot bid on their own listings.');
      err.statusCode = 400;
      throw err;
    }

    // Prohibit outbidding oneself if already highest bidder
    if (listing.leadingBidderId && listing.leadingBidderId.toString() === bidderId.toString()) {
      const err = new Error('You are already the highest bidder for this auction.');
      err.statusCode = 400;
      throw err;
    }

    // Eligibility check
    assertAuctionEligible(listing, now);

    // Calculate minimum required bid
    const isFirstBid = listing.bidCount === 0;
    const minRequiredPaise = isFirstBid
      ? listing.startingPricePaise
      : listing.currentPricePaise + listing.minBidIncrementPaise;

    if (amountPaise < minRequiredPaise) {
      const err = new Error(
        `Bid amount (${amountPaise} paise) is lower than minimum acceptable bid (${minRequiredPaise} paise).`
      );
      err.statusCode = 400;
      throw err;
    }

    // Evaluate anti-sniping extension
    const { shouldExtend, newClosingAt } = evaluateAntiSniping(listing.closingAt, now);

    previousLeaderId = listing.leadingBidderId;

    // Check if an existing competing AutoBid is active for another user
    const competingAutoBids = await AutoBid.find({
      listingId,
      bidderId: { $ne: bidderId },
      enabled: true,
      maxAmountPaise: { $gt: amountPaise },
    })
      .sort({ maxAmountPaise: -1, createdAt: 1 })
      .session(session);

    let finalLeaderId = bidderId;
    let finalCurrentPricePaise = amountPaise;
    let newStatus = shouldExtend ? 'EXTENDED' : listing.status;

    // Create the manual bid
    const manualBid = await Bid.create(
      [
        {
          listingId,
          bidderId,
          amountPaise,
          source: 'MANUAL',
          isWinning: competingAutoBids.length === 0,
          createdAt: now,
        },
      ],
      { session }
    );

    let autoBidRecord = null;

    // If an existing AutoBid outbids this manual bid:
    if (competingAutoBids.length > 0) {
      const winningAuto = competingAutoBids[0];
      finalLeaderId = winningAuto.bidderId;

      // Auto-raise price to manualBid + increment, capped by winningAuto.maxAmountPaise
      const autoPrice = Math.min(
        winningAuto.maxAmountPaise,
        amountPaise + listing.minBidIncrementPaise
      );
      finalCurrentPricePaise = autoPrice;

      const autoNow = new Date(now.getTime() + 50);
      autoBidRecord = await Bid.create(
        [
          {
            listingId,
            bidderId: winningAuto.bidderId,
            amountPaise: autoPrice,
            source: 'AUTO',
            isWinning: true,
            createdAt: autoNow,
          },
        ],
        { session }
      );
    }

    // Atomically update listing state
    listing.currentPricePaise = finalCurrentPricePaise;
    listing.leadingBidderId = finalLeaderId;
    listing.bidCount += autoBidRecord ? 2 : 1;
    listing.closingAt = newClosingAt;
    listing.status = newStatus;
    listing.version += 1;

    await listing.save({ session });

    // Prepare socket broadcast payload
    broadcastPayload = {
      listingId: listing._id,
      currentPricePaise: finalCurrentPricePaise,
      leadingBidderId: finalLeaderId,
      bidCount: listing.bidCount,
      closingAt: newClosingAt,
      status: newStatus,
      lastBid: {
        amountPaise: autoBidRecord ? autoBidRecord[0].amountPaise : manualBid[0].amountPaise,
        source: autoBidRecord ? 'AUTO' : 'MANUAL',
        createdAt: autoBidRecord ? autoBidRecord[0].createdAt : manualBid[0].createdAt,
        bidderName: `Bidder ***${finalLeaderId ? finalLeaderId.toString().slice(-4) : ''}`,
      },
    };

    return {
      success: true,
      acceptedBid: manualBid[0],
      autoResponseBid: autoBidRecord ? autoBidRecord[0] : null,
      listing,
    };
  });

  // ONLY AFTER TRANSACTION COMMITS: Broadcast to Socket.IO & notify outbid user
  if (broadcastPayload) {
    emitAuctionUpdate(listingId, 'auction:bid', broadcastPayload);
  }

  if (previousLeaderId && previousLeaderId.toString() !== result.listing.leadingBidderId.toString()) {
    createNotification({
      recipientId: previousLeaderId.toString(),
      type: 'OUTBID',
      listingId,
      message: `You have been outbid on "${result.listing.title}". Current bid is now ₹${result.listing.currentPricePaise / 100}.`,
      data: { currentPricePaise: result.listing.currentPricePaise },
      eventKey: `outbid_${listingId}_${result.listing.currentPricePaise}`,
    });
  }

  return result;
}

/**
 * Configure or update a private AutoBid ceiling.
 * @param {Object} params
 * @param {string} params.listingId
 * @param {string} params.bidderId
 * @param {number} params.maxAmountPaise
 */
export async function configureAutoBid({ listingId, bidderId, maxAmountPaise }) {
  if (!Number.isInteger(maxAmountPaise) || maxAmountPaise <= 0) {
    const err = new Error('Maximum amount must be a positive integer in paise.');
    err.statusCode = 400;
    throw err;
  }

  let broadcastPayload = null;
  let previousLeaderId = null;

  const result = await withTransaction(async (session) => {
    const now = new Date();
    const listing = await Listing.findById(listingId).session(session);

    if (!listing) {
      const err = new Error('Listing not found.');
      err.statusCode = 404;
      throw err;
    }

    if (listing.sellerId.toString() === bidderId.toString()) {
      const err = new Error('Sellers cannot configure autobids on their own listings.');
      err.statusCode = 400;
      throw err;
    }

    assertAuctionEligible(listing, now);

    const minRequiredPaise =
      listing.bidCount === 0
        ? listing.startingPricePaise
        : listing.currentPricePaise + listing.minBidIncrementPaise;

    if (maxAmountPaise < minRequiredPaise) {
      const err = new Error(
        `AutoBid maximum (${maxAmountPaise} paise) must be at least the next minimum bid (${minRequiredPaise} paise).`
      );
      err.statusCode = 400;
      throw err;
    }

    // Upsert the private AutoBid configuration
    const autobidConfig = await AutoBid.findOneAndUpdate(
      { listingId, bidderId },
      { maxAmountPaise, enabled: true },
      { upsert: true, new: true, session }
    );

    // Resolve competing AutoBids for this listing
    const allAutoBids = await AutoBid.find({
      listingId,
      enabled: true,
    })
      .sort({ maxAmountPaise: -1, createdAt: 1 }) // higher max wins, tie broken by earlier createdAt
      .session(session);

    const topAuto = allAutoBids[0];
    const secondAuto = allAutoBids[1];

    previousLeaderId = listing.leadingBidderId;

    let targetPrice = listing.currentPricePaise;
    let targetLeaderId = listing.leadingBidderId;

    if (allAutoBids.length === 1) {
      // First autobid on this listing
      if (listing.bidCount === 0) {
        targetPrice = listing.startingPricePaise;
        targetLeaderId = topAuto.bidderId;
      } else if (listing.leadingBidderId?.toString() !== topAuto.bidderId.toString()) {
        targetPrice = Math.min(topAuto.maxAmountPaise, listing.currentPricePaise + listing.minBidIncrementPaise);
        targetLeaderId = topAuto.bidderId;
      }
    } else {
      // Competing autobids
      targetLeaderId = topAuto.bidderId;
      const minWinningPrice = secondAuto.maxAmountPaise + listing.minBidIncrementPaise;
      targetPrice = Math.min(topAuto.maxAmountPaise, Math.max(listing.currentPricePaise, minWinningPrice));
    }

    // If new bid needs to be recorded:
    if (targetPrice > listing.currentPricePaise || targetLeaderId?.toString() !== listing.leadingBidderId?.toString()) {
      const { shouldExtend, newClosingAt } = evaluateAntiSniping(listing.closingAt, now);

      await Bid.create(
        [
          {
            listingId,
            bidderId: targetLeaderId,
            amountPaise: targetPrice,
            source: 'AUTO',
            isWinning: true,
            createdAt: now,
          },
        ],
        { session }
      );

      listing.currentPricePaise = targetPrice;
      listing.leadingBidderId = targetLeaderId;
      listing.bidCount += 1;
      listing.closingAt = newClosingAt;
      if (shouldExtend) listing.status = 'EXTENDED';
      listing.version += 1;

      await listing.save({ session });

      broadcastPayload = {
        listingId: listing._id,
        currentPricePaise: targetPrice,
        leadingBidderId: targetLeaderId,
        bidCount: listing.bidCount,
        closingAt: listing.closingAt,
        status: listing.status,
        lastBid: {
          amountPaise: targetPrice,
          source: 'AUTO',
          createdAt: now,
          bidderName: `Bidder ***${targetLeaderId ? targetLeaderId.toString().slice(-4) : ''}`,
        },
      };
    }

    return {
      success: true,
      autobid: {
        id: autobidConfig._id,
        listingId: autobidConfig.listingId,
        maxAmountPaise: autobidConfig.maxAmountPaise, // Returned only to the owner
        enabled: autobidConfig.enabled,
      },
      currentPricePaise: listing.currentPricePaise,
      leadingBidderId: listing.leadingBidderId,
    };
  });

  if (broadcastPayload) {
    emitAuctionUpdate(listingId, 'auction:bid', broadcastPayload);
  }

  if (previousLeaderId && previousLeaderId.toString() !== result.leadingBidderId?.toString()) {
    createNotification({
      recipientId: previousLeaderId.toString(),
      type: 'OUTBID',
      listingId,
      message: `You were outbid by an automatic proxy bid on this listing. Current price is now ₹${result.currentPricePaise / 100}.`,
      data: { currentPricePaise: result.currentPricePaise },
      eventKey: `outbid_${listingId}_${result.currentPricePaise}`,
    });
  }

  return result;
}
