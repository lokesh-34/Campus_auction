import express from 'express';
import { getCurrentUser, getPublicProfile, syncUser, updateProfile } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { syncUserSchema, updateProfileSchema } from '../validators/userValidators.js';

export const userRouter = express.Router();

userRouter.post('/sync', requireAuth, validateRequest({ body: syncUserSchema }), syncUser);
userRouter.get('/me', requireAuth, getCurrentUser);
userRouter.patch('/me', requireAuth, validateRequest({ body: updateProfileSchema }), updateProfile);
userRouter.get('/:id/public', getPublicProfile);
