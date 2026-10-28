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
 * Generate natural language explanation using Gemini or Groq based on real listings.
 * @param {string} userQuery
 * @param {Array} listings
 * @returns {Promise<string>}
 */
async function generateAiExplanation(userQuery, listings) {
  const apiKey = env.GEMINI_API_KEY || env.AI_API_KEY;

  if (listings.length === 0) {
    return `I searched our active campus listings for "${userQuery}", but could not find an exact active auction matching those criteria right now. Consider saving this search so you get notified when a fellow student posts one!`;
  }

  const listingSummary = listings
    .map(
      (l, idx) =>
        `${idx + 1}. "${l.title}" (${l.category}, Condition: ${l.condition}) - Current bid: ₹${l.currentPricePaise / 100}, Closing at: ${new Date(l.closingAt).toLocaleTimeString()}`
    )
    .join('\n');

  if (apiKey) {
    try {
      const prompt = `You are CampusBid AI, a friendly campus marketplace assistant.
The student asked: "${userQuery}".
Here are the actual matching active listings in the campus database:
${listingSummary}

Give a concise, helpful 2-3 sentence recommendation explaining why these items match their search and noting their current auction prices. Do not invent any facts, items, or numbers not listed above.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.2 },
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

  return `I found ${listings.length} active campus auction(s) matching your request:`;
}

/**
 * Process AI query against real database listings.
 * @param {string} userQuery
 */
export async function processAiQuery(userQuery) {
  const filters = extractStructuredFilters(userQuery);

  // Search authoritative listings from MongoDB
  const matchingListings = await Listing.find(filters)
    .populate('sellerId', 'displayName stats')
    .sort({ closingAt: 1 })
    .limit(5);

  const explanation = await generateAiExplanation(userQuery, matchingListings);

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
      minNextBidPaise:
        item.bidCount === 0
          ? item.startingPricePaise
          : item.currentPricePaise + item.minBidIncrementPaise,
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
