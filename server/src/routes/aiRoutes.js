import express from 'express';
import { proposeBid, queryAiAssistant } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/auth.js';
import { strictLimiter } from '../middleware/rateLimiter.js';

export const aiRouter = express.Router();

aiRouter.post('/query', strictLimiter, queryAiAssistant);
aiRouter.post('/propose-bid', requireAuth, strictLimiter, proposeBid);
