import { Listing } from '../models/index.js';
import { env } from '../config/env.js';

/**
 * Extracts structured search filters from user natural language query.
 * @param {string} query
 */
export function extractStructuredFilters(query) {
  const lower = query.toLowerCase();
  const filters = {
    status: { $in: ['ACTIVE', 'EXTENDED'] },
  };

  // Category detection
  if (lower.includes('cycle') || lower.includes('bicycle') || lower.includes('bike')) {
    filters.category = 'CYCLES';
  } else if (lower.includes('book') || lower.includes('clrs') || lower.includes('notes') || lower.includes('textbook')) {
    filters.category = 'TEXTBOOKS';
  } else if (lower.includes('calculator') || lower.includes('casio')) {
    filters.category = 'CALCULATORS';
  } else if (lower.includes('laptop') || lower.includes('phone') || lower.includes('electronics') || lower.includes('charger')) {
    filters.category = 'ELECTRONICS';
  } else if (lower.includes('lab') || lower.includes('drafter') || lower.includes('coat')) {
    filters.category = 'LAB_EQUIPMENT';
  } else if (lower.includes('chair') || lower.includes('desk') || lower.includes('bed') || lower.includes('mattress')) {
    filters.category = 'FURNITURE';
  }

  // Price detection (e.g. "under ₹2,000" or "under 2000" or "below 1500")
  const priceMatch = lower.match(/(?:under|below|less than|max)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)?)/i);
  if (priceMatch) {
    const rupees = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(rupees)) {
      filters.currentPricePaise = { $lte: rupees * 100 };
    }
  }

  // Condition detection
  if (lower.includes('like new') || lower.includes('brand new')) {
    filters.condition = { $in: ['NEW', 'LIKE_NEW'] };
  }

  return filters;
}

/**
 * Process AI query against real database listings.
 * @param {string} userQuery
 */
export async function processAiQuery(userQuery) {
  const filters = extractStructuredFilters(userQuery);

  // Search authoritative listings
  const matchingListings = await Listing.find(filters)
    .populate('sellerId', 'displayName stats')
    .sort({ closingAt: 1 })
    .limit(5);

  let explanation = '';
  if (matchingListings.length === 0) {
    explanation = `I searched our active campus listings for "${userQuery}", but did not find an exact match under those criteria. Would you like to create a Saved Search so you get notified when one is listed?`;
  } else {
    explanation = `I found ${matchingListings.length} active campus auction(s) matching your request:`;
  }

  return {
    query: userQuery,
    parsedFilters: filters,
    listings: matchingListings.map((item) => ({
      id: item._id,
      title: item.title,
      category: item.category,
      condition: item.condition,
      currentPricePaise: item.currentPricePaise,
      currentPriceRupees: item.currentPricePaise / 100,
      minNextBidPaise: item.bidCount === 0 ? item.startingPricePaise : item.currentPricePaise + item.minBidIncrementPaise,
      closingAt: item.closingAt,
      seller: item.sellerId ? item.sellerId.displayName : 'Campus Seller',
      images: item.images,
    })),
    explanation,
  };
}

/**
 * Propose a structured bidding action that requires explicit user confirmation.
 * @param {string} listingId
 * @param {string} actionType - 'MANUAL_BID' | 'AUTO_BID'
 * @param {number} proposedAmountRupees
 */
export async function proposeBiddingAction(listingId, actionType, proposedAmountRupees) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }

  const proposedAmountPaise = Math.round(proposedAmountRupees * 100);
  const minRequiredPaise =
    listing.bidCount === 0
      ? listing.startingPricePaise
      : listing.currentPricePaise + listing.minBidIncrementPaise;

  const isEligible = proposedAmountPaise >= minRequiredPaise;

  return {
    listingId: listing._id,
    title: listing.title,
    actionType,
    currentPricePaise: listing.currentPricePaise,
    currentPriceRupees: listing.currentPricePaise / 100,
    minRequiredPaise,
    minRequiredRupees: minRequiredPaise / 100,
    proposedAmountPaise,
    proposedAmountRupees,
    isEligible,
    warning: isEligible
      ? 'Please confirm: This action will be submitted to the authoritative bidding engine.'
      : `Proposed amount is below the required minimum of ₹${minRequiredPaise / 100}.`,
    requiresConfirmation: true,
  };
}
