import express from 'express';
import {
  cancelListing,
  createListing,
  getListingById,
  getListings,
  getMyListings,
  updateListing,
} from '../controllers/listingController.js';
import { requireAuth } from '../middleware/auth.js';
import { strictLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  cancelListingSchema,
  createListingSchema,
  queryListingsSchema,
  updateListingSchema,
} from '../validators/listingValidators.js';

export const listingRouter = express.Router();

listingRouter.get('/', validateRequest({ query: queryListingsSchema }), getListings);
listingRouter.get('/seller/me', requireAuth, getMyListings);
listingRouter.get('/:id', getListingById);
listingRouter.post(
  '/',
  requireAuth,
  strictLimiter,
  validateRequest({ body: createListingSchema }),
  createListing
);
listingRouter.patch('/:id', requireAuth, validateRequest({ body: updateListingSchema }), updateListing);
listingRouter.post(
  '/:id/cancel',
  requireAuth,
  validateRequest({ body: cancelListingSchema }),
  cancelListing
);
