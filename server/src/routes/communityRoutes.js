import express from 'express';
import {
  answerQuestion,
  askQuestion,
  createSavedSearch,
  deleteSavedSearch,
  getListingQuestions,
  getNotifications,
  getSavedSearches,
  getWatchlist,
  markAllNotificationsRead,
  markNotificationRead,
  toggleWatchlist,
} from '../controllers/communityController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  answerQuestionSchema,
  askQuestionSchema,
  savedSearchSchema,
} from '../validators/communityValidators.js';

export const communityRouter = express.Router();

// Questions
communityRouter.get('/listings/:id/questions', getListingQuestions);
communityRouter.post(
  '/listings/:id/questions',
  requireAuth,
  validateRequest({ body: askQuestionSchema }),
  askQuestion
);
communityRouter.post(
  '/questions/:id/answer',
  requireAuth,
  validateRequest({ body: answerQuestionSchema }),
  answerQuestion
);

// Watchlist
communityRouter.get('/watchlist', requireAuth, getWatchlist);
communityRouter.post('/watchlist/:id', requireAuth, toggleWatchlist);

// Notifications
communityRouter.get('/notifications', requireAuth, getNotifications);
communityRouter.patch('/notifications/:id/read', requireAuth, markNotificationRead);
communityRouter.post('/notifications/read-all', requireAuth, markAllNotificationsRead);

// Saved Searches
communityRouter.post(
  '/saved-searches',
  requireAuth,
  validateRequest({ body: savedSearchSchema }),
  createSavedSearch
);
communityRouter.get('/saved-searches', requireAuth, getSavedSearches);
communityRouter.delete('/saved-searches/:id', requireAuth, deleteSavedSearch);
