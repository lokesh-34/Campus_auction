import express from 'express';
import {
  disableAutoBid,
  getBidHistory,
  getMyAutoBid,
  placeBid,
  setAutoBid,
} from '../controllers/bidController.js';
import { requireAuth } from '../middleware/auth.js';
import { strictLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { autoBidSchema, placeBidSchema } from '../validators/bidValidators.js';

export const bidRouter = express.Router();

bidRouter.get('/listings/:id/bids', getBidHistory);
bidRouter.post(
  '/listings/:id/bids',
  requireAuth,
  strictLimiter,
  validateRequest({ body: placeBidSchema }),
  placeBid
);
bidRouter.post(
  '/listings/:id/autobid',
  requireAuth,
  strictLimiter,
  validateRequest({ body: autoBidSchema }),
  setAutoBid
);
bidRouter.get('/listings/:id/autobid', requireAuth, getMyAutoBid);
bidRouter.delete('/listings/:id/autobid', requireAuth, disableAutoBid);
