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
  } else if (lower.includes('laptop') || lower.includes('phone') || lower.includes('electronics') || lower.includes('charger') || lower.includes('camera')) {
    filters.category = 'ELECTRONICS';
  } else if (lower.includes('lab') || lower.includes('drafter') || lower.includes('coat')) {
    filters.category = 'LAB_EQUIPMENT';
  } else if (lower.includes('chair') || lower.includes('desk') || lower.includes('bed') || lower.includes('mattress')) {
    filters.category = 'FURNITURE';
  }

  // Price detection (e.g. "under ₹4,000" or "under 2000" or "below 1500")
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
 * Extracts action intent (e.g. "auto bid it till 5000", "bid 3500") from user query.
 * @param {string} query
 */
export function extractActionIntent(query) {
  const lower = query.toLowerCase();

  // AutoBid intent detection:
  // e.g. "auto bid it till 5000", "autobid up to 4500", "auto bid 5000", "autobid till 5000"
  const autoBidMatch = lower.match(
    /(?:auto[\s-]?bid|proxy(?:\s+bid)?)\s*(?:it|on it|item)?\s*(?:till|to|up to|at|for)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)?)/i
  );

  if (autoBidMatch) {
    const rupees = parseInt(autoBidMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(rupees) && rupees > 0) {
      return {
        actionType: 'AUTO_BID',
        targetAmountRupees: rupees,
        targetAmountPaise: rupees * 100,
      };
    }
  }

  // Manual bid intent detection:
  // e.g. "bid 3500", "place bid 4000", "bid ₹3,800"
  const manualBidMatch = lower.match(
    /(?:place\s+bid|bid|offer)\s*(?:it)?\s*(?:of|at|for|till)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)?)/i
  );

  if (manualBidMatch) {
    const rupees = parseInt(manualBidMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(rupees) && rupees > 0) {
      return {
        actionType: 'MANUAL_BID',
        targetAmountRupees: rupees,
        targetAmountPaise: rupees * 100,
      };
    }
  }

  return null;
}

/**
 * Generate natural language explanation using Gemini or Groq based on real listings.
 * @param {string} userQuery
 * @param {Array} listings
 * @param {Object|null} suggestedAction
 * @returns {Promise<string>}
 */
async function generateAiExplanation(userQuery, listings, suggestedAction = null) {
  const apiKey = env.GEMINI_API_KEY || env.AI_API_KEY;

  if (listings.length === 0) {
    return `I searched our active campus listings for "${userQuery}", but could not find an exact active auction matching those criteria right now. Consider saving this search so you get notified when a fellow student posts one!`;
  }

  const listingSummary = listings
    .map(
      (l, idx) =>
        `${idx + 1}. "${l.title}" (${l.category}, Condition: ${l.condition}) - Current bid: ₹${l.currentPricePaise / 100}, Starting: ₹${l.startingPricePaise / 100}, Closing at: ${new Date(l.closingAt).toLocaleTimeString()}`
    )
    .join('\n');

  let actionNote = '';
  if (suggestedAction) {
    actionNote = `\nNote: The student also requested to ${suggestedAction.actionType === 'AUTO_BID' ? 'auto-bid' : 'bid'} up to ₹${suggestedAction.proposedAmountRupees} on "${suggestedAction.title}". Confirm that an action proposal card is prepared below for them to review and approve.`;
  }

  if (apiKey) {
    try {
      const prompt = `You are CampusBid AI, an intelligent, helpful campus marketplace assistant.
The student asked: "${userQuery}".
Here are the actual matching active listings in the campus database:
${listingSummary}
${actionNote}

Give a concise, helpful 2-3 sentence recommendation. Highlight the matching item and its current price. If an action proposal (like auto-bidding) was prepared, mention that they can review and confirm it with one click below. Do not invent any items or numbers not listed above.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 250, temperature: 0.2 },
          }),
        }
      );

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      }
    } catch (err) {
      console.warn('Gemini explanation fallback:', err.message);
    }
  }

  if (suggestedAction) {
    return `I found matching active listings for "${userQuery}". I've also prepared an AutoBid proposal of ₹${suggestedAction.proposedAmountRupees} for "${suggestedAction.title}" below for your review.`;
  }

  return `I found ${listings.length} active campus auction(s) matching your request:`;
}

/**
 * Process AI query against real database listings.
 * @param {string} userQuery
 * @param {string|ObjectId|null} excludeSellerId
 */
export async function processAiQuery(userQuery, excludeSellerId = null) {
  const filters = extractStructuredFilters(userQuery);
  const actionIntent = extractActionIntent(userQuery);

  // Never list seller's own products for buying
  if (excludeSellerId) {
    filters.sellerId = { $ne: excludeSellerId };
  }

  // 1. Search authoritative listings from MongoDB with parsed filters
  let matchingListings = await Listing.find(filters)
    .populate('sellerId', 'displayName stats')
    .sort({ closingAt: 1 })
    .limit(5);

  // 2. Fallback: If price filter yielded 0 matches but category exists,
  // search by category so the user still discovers available campus items
  if (matchingListings.length === 0 && filters.category) {
    const fallbackCategoryFilter = {
      category: filters.category,
      status: { $in: ['ACTIVE', 'EXTENDED'] },
      ...(excludeSellerId ? { sellerId: { $ne: excludeSellerId } } : {}),
    };

    matchingListings = await Listing.find(fallbackCategoryFilter)
      .populate('sellerId', 'displayName stats')
      .sort({ currentPricePaise: 1 })
      .limit(5);
  }

  // 3. Fallback: Keyword search
  if (matchingListings.length === 0) {
    const cleanKeyword = userQuery
      .replace(/under.*$/i, '')
      .replace(/auto.*$/i, '')
      .replace(/bid.*$/i, '')
      .trim();

    if (cleanKeyword.length >= 3) {
      const keywordFilter = {
        $text: { $search: cleanKeyword },
        status: { $in: ['ACTIVE', 'EXTENDED'] },
        ...(excludeSellerId ? { sellerId: { $ne: excludeSellerId } } : {}),
      };

      matchingListings = await Listing.find(keywordFilter)
        .populate('sellerId', 'displayName stats')
        .limit(5);
    }
  }

  // Construct suggestedAction if action intent was detected
  let suggestedAction = null;
  if (actionIntent && matchingListings.length > 0) {
    const targetListing = matchingListings[0];
    const minRequiredPaise =
      targetListing.bidCount === 0
        ? targetListing.startingPricePaise
        : targetListing.currentPricePaise + targetListing.minBidIncrementPaise;

    const isEligible = actionIntent.targetAmountPaise >= minRequiredPaise;

    suggestedAction = {
      listingId: targetListing._id,
      title: targetListing.title,
      category: targetListing.category,
      actionType: actionIntent.actionType,
      currentPricePaise: targetListing.currentPricePaise,
      currentPriceRupees: targetListing.currentPricePaise / 100,
      minRequiredPaise,
      minRequiredRupees: minRequiredPaise / 100,
      proposedAmountPaise: actionIntent.targetAmountPaise,
      proposedAmountRupees: actionIntent.targetAmountRupees,
      isEligible,
      requiresConfirmation: true,
      message:
        actionIntent.actionType === 'AUTO_BID'
          ? `AutoBid proposal: Automatically defend your lead up to ₹${actionIntent.targetAmountRupees}.`
          : `Bid proposal: Submit manual bid of ₹${actionIntent.targetAmountRupees}.`,
    };
  }

  const explanation = await generateAiExplanation(userQuery, matchingListings, suggestedAction);

  return {
    query: userQuery,
    parsedFilters: filters,
    actionIntent,
    suggestedAction,
    listings: matchingListings.map((item) => ({
      id: item._id,
      title: item.title,
      category: item.category,
      condition: item.condition,
      currentPricePaise: item.currentPricePaise,
      currentPriceRupees: item.currentPricePaise / 100,
      minNextBidPaise:
        item.bidCount === 0
          ? item.startingPricePaise
          : item.currentPricePaise + item.minBidIncrementPaise,
      closingAt: item.closingAt,
      seller: item.sellerId ? item.sellerId.displayName : 'Campus Seller',
      sellerId: item.sellerId?._id || item.sellerId,
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
 * @param {string|ObjectId|null} userId
 */
export async function proposeBiddingAction(listingId, actionType, proposedAmountRupees, userId = null) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }

  if (userId && listing.sellerId.toString() === userId.toString()) {
    const err = new Error('Sellers cannot bid on or buy their own listings.');
    err.statusCode = 400;
    throw err;
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
      ? actionType === 'AUTO_BID'
        ? 'Please confirm: This will configure automatic proxy bidding up to your maximum ceiling.'
        : 'Please confirm: This action will be submitted to the authoritative bidding engine.'
      : `Proposed amount is below the required minimum of ₹${minRequiredPaise / 100}.`,
    requiresConfirmation: true,
  };
}
