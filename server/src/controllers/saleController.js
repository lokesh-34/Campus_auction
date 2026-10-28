import { Sale, User } from '../models/index.js';
import { createNotification } from '../services/notificationService.js';

/**
 * Strips sensitive handover credentials if the requesting user is NOT the buyer
 * while the item is still reserved/awaiting handover.
 */
function sanitizeSaleForUser(sale, userId) {
  if (!sale) return sale;
  const obj = sale.toObject ? sale.toObject() : { ...sale };
  const currentUserId = userId?._id ? userId._id.toString() : userId?.toString();
  const buyerId = obj.winnerId?._id ? obj.winnerId._id.toString() : obj.winnerId?.toString();

  // The 6-digit OTP is confidential to the buyer until physical verification completes
  if (obj.outcome === 'RESERVED' && currentUserId !== buyerId) {
    delete obj.handoverOtp;
  }
  return obj;
}

export async function getSaleById(req, res, next) {
  try {
    const { id } = req.params;
    let sale = await Sale.findById(id)
      .populate('listingId', 'title category currentPricePaise images pickupPoint sellerPhone')
      .populate(
        'sellerId',
        'displayName stats profileImage department year isVerifiedStudent verifiedEmailDomain phoneNumber pickupPoint'
      )
      .populate(
        'winnerId',
        'displayName stats profileImage department year isVerifiedStudent verifiedEmailDomain phoneNumber pickupPoint'
      );

    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale record not found', code: 'NOT_FOUND' },
      });
    }

    // Auto-generate OTP if reserved but lacks one
    if (sale.outcome === 'RESERVED' && !sale.handoverOtp) {
      sale.generateHandoverOtp();
      await sale.save();
    }

    const sanitized = sanitizeSaleForUser(sale, req.user._id);

    res.json({
      success: true,
      data: sanitized,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveSale(req, res, next) {
  try {
    const { id } = req.params;
    const seller = req.user;

    const sale = await Sale.findById(id).populate('listingId');
    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale not found', code: 'NOT_FOUND' },
      });
    }

    if (sale.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller can approve this sale', code: 'FORBIDDEN' },
      });
    }

    if (sale.outcome !== 'PENDING_SELLER_APPROVAL') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Cannot approve sale in current status: ${sale.outcome}`,
          code: 'INVALID_STATUS',
        },
      });
    }

    sale.outcome = 'RESERVED';
    sale.sellerDecisionAt = new Date();
    // 72-hour window for campus handover
    sale.reservationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    // Generate secure 6-digit dynamic OTP for buyer verification
    const otp = sale.generateHandoverOtp();
    await sale.save();

    // Notify buyer that item is reserved with OTP guidance
    if (sale.winnerId) {
      const pickupInfo = sale.pickupPoint ? ` Meet at: ${sale.pickupPoint}.` : '';
      const phoneInfo = sale.sellerPhone ? ` Seller Phone: ${sale.sellerPhone}.` : '';
      createNotification({
        recipientId: sale.winnerId.toString(),
        type: 'RESERVATION_ACTIVE',
        listingId: sale.listingId._id.toString(),
        saleId: sale._id.toString(),
        message: `Seller approved your winning bid for "${sale.listingId.title}"! Dynamic handover code [${otp}] generated.${pickupInfo}${phoneInfo}`,
        data: {
          listingId: sale.listingId._id.toString(),
          saleId: sale._id.toString(),
          pickupPoint: sale.pickupPoint,
          sellerPhone: sale.sellerPhone,
        },
        eventKey: `reserved_${sale._id}`,
      });
    }

    const sanitized = sanitizeSaleForUser(sale, req.user._id);

    res.json({
      success: true,
      data: sanitized,
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectSale(req, res, next) {
  try {
    const { id } = req.params;
    const seller = req.user;

    const sale = await Sale.findById(id).populate('listingId');
    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale not found', code: 'NOT_FOUND' },
      });
    }

    if (sale.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller can reject this sale', code: 'FORBIDDEN' },
      });
    }

    if (sale.outcome !== 'PENDING_SELLER_APPROVAL') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Cannot reject sale in current status: ${sale.outcome}`,
          code: 'INVALID_STATUS',
        },
      });
    }

    sale.outcome = 'REJECTED';
    sale.sellerDecisionAt = new Date();
    await sale.save();

    if (sale.winnerId) {
      createNotification({
        recipientId: sale.winnerId.toString(),
        type: 'SALE_REJECTED',
        listingId: sale.listingId._id.toString(),
        saleId: sale._id.toString(),
        message: `Seller declined the final price for "${sale.listingId.title}". The auction outcome is rejected.`,
        eventKey: `rejected_${sale._id}`,
      });
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * In-Person Handover OTP & Dynamic QR Code Atomic Verification
 * Seller enters the 6-digit OTP displayed on the buyer's screen upon inspecting the item.
 */
export async function verifyHandoverOtp(req, res, next) {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const seller = req.user;

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Please provide a valid 6-digit handover OTP code', code: 'INVALID_OTP' },
      });
    }

    const sale = await Sale.findById(id).populate('listingId');
    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale not found', code: 'NOT_FOUND' },
      });
    }

    if (sale.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller can verify the in-person handover code', code: 'FORBIDDEN' },
      });
    }

    if (sale.outcome !== 'RESERVED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Cannot verify handover on sale with status: ${sale.outcome}`,
          code: 'INVALID_STATUS',
        },
      });
    }

    // Rate-limit brute force attempts (max 5 attempts per reserved handover)
    if (sale.handoverAttempts >= 5) {
      return res.status(429).json({
        success: false,
        data: null,
        error: {
          message: 'Too many incorrect attempts. Ask buyer to regenerate their code.',
          code: 'TOO_MANY_ATTEMPTS',
        },
      });
    }

    const cleanInputOtp = otp.trim();
    if (!sale.handoverOtp || sale.handoverOtp !== cleanInputOtp) {
      sale.handoverAttempts = (sale.handoverAttempts || 0) + 1;
      await sale.save();
      const remainingAttempts = 5 - sale.handoverAttempts;
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Incorrect 6-digit handover code (${remainingAttempts} attempts remaining). Please check the buyer's screen.`,
          code: 'INVALID_CODE',
        },
      });
    }

    // Atomic Handover Completion
    sale.outcome = 'SOLD';
    sale.handoverConfirmedSellerAt = new Date();
    sale.handoverConfirmedBuyerAt = new Date();
    sale.handoverCompletedAt = new Date();
    sale.handoverVerifiedVia = 'OTP';
    await sale.save();

    // Reward Student Reputation & Karma Points (+10 Karma for successful completion)
    const [sellerUser, buyerUser] = await Promise.all([
      User.findById(sale.sellerId),
      User.findById(sale.winnerId),
    ]);

    if (sellerUser) {
      sellerUser.updateReputation('SALE_COMPLETED');
      await sellerUser.save();
    }
    if (buyerUser) {
      buyerUser.updateReputation('SALE_COMPLETED');
      await buyerUser.save();
    }

    // Dispatch realtime completion notifications
    createNotification({
      recipientId: sale.winnerId.toString(),
      type: 'HANDOVER_CONFIRMED',
      listingId: sale.listingId._id.toString(),
      saleId: sale._id.toString(),
      message: `Possession verified! Handover completed for "${sale.listingId.title}". +10 Karma points added to your student profile!`,
      eventKey: `sold_${sale._id}`,
    });

    createNotification({
      recipientId: sale.sellerId.toString(),
      type: 'HANDOVER_CONFIRMED',
      listingId: sale.listingId._id.toString(),
      saleId: sale._id.toString(),
      message: `Handover verified! "${sale.listingId.title}" is officially sold. +10 Karma points added to your student profile!`,
      eventKey: `sold_seller_${sale._id}`,
    });

    res.json({
      success: true,
      data: sale,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Regenerate dynamic OTP (Buyer only)
 */
export async function refreshHandoverOtp(req, res, next) {
  try {
    const { id } = req.params;
    const buyer = req.user;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale not found', code: 'NOT_FOUND' },
      });
    }

    if (sale.winnerId?.toString() !== buyer._id.toString()) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the buyer can refresh their handover code', code: 'FORBIDDEN' },
      });
    }

    if (sale.outcome !== 'RESERVED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Cannot refresh code for an unreserved sale', code: 'INVALID_STATUS' },
      });
    }

    const newOtp = sale.generateHandoverOtp();
    await sale.save();

    res.json({
      success: true,
      data: {
        saleId: sale._id,
        handoverOtp: newOtp,
        handoverOtpExpiresAt: sale.handoverOtpExpiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmHandover(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    const sale = await Sale.findById(id).populate('listingId');
    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale not found', code: 'NOT_FOUND' },
      });
    }

    if (sale.outcome !== 'RESERVED') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `Cannot confirm handover on sale with status: ${sale.outcome}`,
          code: 'INVALID_STATUS',
        },
      });
    }

    const isSeller = sale.sellerId.toString() === user._id.toString();
    const isBuyer = sale.winnerId?.toString() === user._id.toString();

    if (!isSeller && !isBuyer) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller or buyer can confirm handover', code: 'FORBIDDEN' },
      });
    }

    if (isSeller) {
      sale.handoverConfirmedSellerAt = new Date();
    }
    if (isBuyer) {
      sale.handoverConfirmedBuyerAt = new Date();
    }

    if (sale.handoverConfirmedSellerAt && sale.handoverConfirmedBuyerAt) {
      sale.outcome = 'SOLD';
      sale.handoverCompletedAt = new Date();
      sale.handoverVerifiedVia = 'MANUAL';

      const [sellerUser, buyerUser] = await Promise.all([
        User.findById(sale.sellerId),
        User.findById(sale.winnerId),
      ]);

      if (sellerUser) {
        sellerUser.updateReputation('SALE_COMPLETED');
        await sellerUser.save();
      }
      if (buyerUser) {
        buyerUser.updateReputation('SALE_COMPLETED');
        await buyerUser.save();
      }

      createNotification({
        recipientId: sale.winnerId.toString(),
        type: 'HANDOVER_CONFIRMED',
        listingId: sale.listingId._id.toString(),
        saleId: sale._id.toString(),
        message: `Handover complete for "${sale.listingId.title}". Transaction is now officially finished!`,
        eventKey: `sold_${sale._id}`,
      });

      createNotification({
        recipientId: sale.sellerId.toString(),
        type: 'HANDOVER_CONFIRMED',
        listingId: sale.listingId._id.toString(),
        saleId: sale._id.toString(),
        message: `Handover confirmed for "${sale.listingId.title}". +10 Karma points added!`,
        eventKey: `sold_seller_${sale._id}`,
      });
    }

    await sale.save();

    res.json({
      success: true,
      data: sanitizeSaleForUser(sale, req.user._id),
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelSale(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;
    const { reason } = req.body;

    const sale = await Sale.findById(id).populate('listingId');
    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale not found', code: 'NOT_FOUND' },
      });
    }

    const isSeller = sale.sellerId.toString() === user._id.toString();
    const isBuyer = sale.winnerId?.toString() === user._id.toString();

    if (!isSeller && !isBuyer) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Only the seller or buyer can cancel this sale', code: 'FORBIDDEN' },
      });
    }

    sale.outcome = isSeller ? 'SELLER_CANCELLED' : 'FAILED_PICKUP';
    sale.cancellationReason = reason;
    await sale.save();

    // Apply ghosting / cancellation penalty (-25 Karma points) to the cancelling party
    const penalizeUser = await User.findById(user._id);
    if (penalizeUser) {
      penalizeUser.updateReputation('SALE_CANCELLED');
      await penalizeUser.save();
    }

    const otherPartyId = isSeller ? sale.winnerId?.toString() : sale.sellerId.toString();
    if (otherPartyId) {
      createNotification({
        recipientId: otherPartyId,
        type: 'SALE_CANCELLED',
        listingId: sale.listingId._id.toString(),
        saleId: sale._id.toString(),
        message: `The campus handover for "${sale.listingId.title}" was cancelled: "${reason || 'No reason provided'}"`,
        eventKey: `cancelled_${sale._id}`,
      });
    }

    res.json({
      success: true,
      data: sanitizeSaleForUser(sale, req.user._id),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMySales(req, res, next) {
  try {
    const user = req.user;
    const role = req.query.role || 'all';

    let filter = {};
    if (role === 'buyer') {
      filter.winnerId = user._id;
    } else if (role === 'seller') {
      filter.sellerId = user._id;
    } else {
      filter.$or = [{ sellerId: user._id }, { winnerId: user._id }];
    }

    const sales = await Sale.find(filter)
      .populate('listingId', 'title category images currentPricePaise pickupPoint sellerPhone startingPricePaise')
      .populate(
        'sellerId',
        'displayName stats profileImage department year isVerifiedStudent verifiedEmailDomain phoneNumber pickupPoint'
      )
      .populate(
        'winnerId',
        'displayName stats profileImage department year isVerifiedStudent verifiedEmailDomain phoneNumber pickupPoint'
      )
      .sort({ createdAt: -1 });

    // Ensure all active reserved sales have an OTP generated
    for (const sale of sales) {
      if (sale.outcome === 'RESERVED' && !sale.handoverOtp) {
        sale.generateHandoverOtp();
        await sale.save();
      }
    }

    const sanitizedSales = sales.map((s) => sanitizeSaleForUser(s, user._id));

    res.json({
      success: true,
      data: sanitizedSales,
    });
  } catch (err) {
    next(err);
  }
}
