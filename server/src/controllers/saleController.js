import { Sale, User } from '../models/index.js';
import { createNotification } from '../services/notificationService.js';

export async function getSaleById(req, res, next) {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id)
      .populate('listingId', 'title category currentPricePaise images')
      .populate('sellerId', 'displayName stats')
      .populate('winnerId', 'displayName');

    if (!sale) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Sale record not found', code: 'NOT_FOUND' },
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
    await sale.save();

    // Notify buyer that item is reserved
    if (sale.winnerId) {
      const pickupInfo = sale.pickupPoint ? ` Meet at: ${sale.pickupPoint}.` : '';
      const phoneInfo = sale.sellerPhone ? ` Seller Phone: ${sale.sellerPhone}.` : '';
      createNotification({
        recipientId: sale.winnerId.toString(),
        type: 'RESERVATION_ACTIVE',
        listingId: sale.listingId._id.toString(),
        saleId: sale._id.toString(),
        message: `Seller approved your winning bid for "${sale.listingId.title}"! The item is now reserved.${pickupInfo}${phoneInfo}`,
        data: {
          listingId: sale.listingId._id.toString(),
          saleId: sale._id.toString(),
          pickupPoint: sale.pickupPoint,
          sellerPhone: sale.sellerPhone,
        },
        eventKey: `reserved_${sale._id}`,
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

    // If both parties confirmed, mark as SOLD
    if (sale.handoverConfirmedSellerAt && sale.handoverConfirmedBuyerAt) {
      sale.outcome = 'SOLD';

      // Increment seller's completed sales stat
      await User.findByIdAndUpdate(sale.sellerId, {
        $inc: { 'stats.completedSales': 1 },
      });

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
        message: `Handover confirmed for "${sale.listingId.title}". Your completed sales count increased!`,
        eventKey: `sold_seller_${sale._id}`,
      });
    }

    await sale.save();

    res.json({
      success: true,
      data: sale,
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

    res.json({
      success: true,
      data: sale,
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
      .populate('listingId', 'title category images currentPricePaise')
      .populate('sellerId', 'displayName stats')
      .populate('winnerId', 'displayName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sales,
    });
  } catch (err) {
    next(err);
  }
}
