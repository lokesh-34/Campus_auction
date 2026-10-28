import { processAiQuery, proposeBiddingAction } from '../services/aiService.js';

export async function queryAiAssistant(req, res, next) {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Query string is required', code: 'INVALID_QUERY' },
      });
    }

    const result = await processAiQuery(query.trim());

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function proposeBid(req, res, next) {
  try {
    const { listingId, actionType = 'MANUAL_BID', proposedAmountRupees } = req.body;

    if (!listingId || !proposedAmountRupees) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'listingId and proposedAmountRupees are required', code: 'MISSING_FIELDS' },
      });
    }

    const proposal = await proposeBiddingAction(listingId, actionType, Number(proposedAmountRupees));

    res.json({
      success: true,
      data: proposal,
    });
  } catch (err) {
    next(err);
  }
}
