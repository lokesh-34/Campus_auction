import express from 'express';
import {
  approveSale,
  cancelSale,
  confirmHandover,
  getMySales,
  getSaleById,
  refreshHandoverOtp,
  rejectSale,
  verifyHandoverOtp,
} from '../controllers/saleController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { cancelSaleSchema } from '../validators/communityValidators.js';

export const saleRouter = express.Router();

saleRouter.get('/my', requireAuth, getMySales);
saleRouter.get('/:id', requireAuth, getSaleById);
saleRouter.post('/:id/approve', requireAuth, approveSale);
saleRouter.post('/:id/reject', requireAuth, rejectSale);
saleRouter.post('/:id/verify-otp', requireAuth, verifyHandoverOtp);
saleRouter.post('/:id/refresh-otp', requireAuth, refreshHandoverOtp);
saleRouter.post('/:id/confirm-handover', requireAuth, confirmHandover);
saleRouter.post('/:id/cancel', requireAuth, validateRequest({ body: cancelSaleSchema }), cancelSale);
