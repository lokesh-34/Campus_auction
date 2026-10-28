import express from 'express';
import { getSignedUploadUrl, mockDirectUpload } from '../controllers/uploadController.js';
import { requireAuth } from '../middleware/auth.js';
import { strictLimiter } from '../middleware/rateLimiter.js';

export const uploadRouter = express.Router();

uploadRouter.post('/sign', requireAuth, strictLimiter, getSignedUploadUrl);
uploadRouter.post('/mock-upload', requireAuth, mockDirectUpload);
