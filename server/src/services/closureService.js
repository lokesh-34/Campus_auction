import { withTransaction } from '../config/db.js';
import { Listing, Sale, User } from '../models/index.js';
import { emitAuctionUpdate } from '../sockets/socketManager.js';
import { createNotification } from './notificationService.js';

/**
 * Reconciles overdue auctions by transitioning them to CLOSED and creating corresponding Sale records.
 * Can be called on a schedule by the background worker or on-demand before querying specific auctions.
 * @returns {Promise<{ closedCount: number }>}
 */
export async function reconcileOverdueAuctions() {
  const now = new Date();

  // Find all active/extended auctions whose closing time has passed
  const overdueListings = await Listing.find({
    status: { $in: ['ACTIVE', 'EXTENDED'] },
    closingAt: { $lte: now },
  }).limit(50); // Process in batches

  let closedCount = 0;

  for (const listing of overdueListings) {
    try {
      let broadcastPayload = null;
      let notifications = [];

      await withTransaction(async (session) => {
        // Re-fetch under session with check
        const lockedListing = await Listing.findOne({
          _id: listing._id,
          status: { $in: ['ACTIVE', 'EXTENDED'] },
        }).session(session);

        if (!lockedListing) return;

        lockedListing.status = 'CLOSED';
        lockedListing.version += 1;
        await lockedListing.save({ session });

        const hasWinner = lockedListing.bidCount > 0 && lockedListing.leadingBidderId;

        let pickupPoint = 'Campus Central Library / Student Activity Center';
        let sellerPhone = '';
        let seller = null;

        if (hasWinner) {
          seller = await User.findById(lockedListing.sellerId).session(session);
          pickupPoint =
            lockedListing.pickupPoint?.trim() ||
            seller?.pickupPoint?.trim() ||
            'Campus Central Library / Student Activity Center';
          sellerPhone =
            lockedListing.sellerPhone?.trim() ||
            seller?.phoneNumber?.trim() ||
            'Not provided (Coordinate via CampusBid Chat)';
        }

        // Upsert Sale record to prevent duplicate creations
        const sale = await Sale.findOneAndUpdate(
          { listingId: lockedListing._id },
          {
            $setOnInsert: {
              listingId: lockedListing._id,
              sellerId: lockedListing.sellerId,
              winnerId: hasWinner ? lockedListing.leadingBidderId : null,
              finalPricePaise: hasWinner ? lockedListing.currentPricePaise : 0,
              outcome: hasWinner ? 'PENDING_SELLER_APPROVAL' : 'UNSOLD',
              pickupPoint: hasWinner ? pickupPoint : '',
              sellerPhone: hasWinner ? sellerPhone : '',
            },
          },
          { upsert: true, new: true, session }
        );

        broadcastPayload = {
          listingId: lockedListing._id,
          status: 'CLOSED',
          hasWinner: Boolean(hasWinner),
          finalPricePaise: sale.finalPricePaise,
          winnerId: sale.winnerId,
          pickupPoint: hasWinner ? pickupPoint : undefined,
          sellerPhone: hasWinner ? sellerPhone : undefined,
        };

        if (hasWinner) {
          notifications.push({
            recipientId: lockedListing.leadingBidderId.toString(),
            type: 'AUCTION_WON',
            listingId: lockedListing._id.toString(),
            saleId: sale._id.toString(),
            message: `🎉 Congratulations! You placed the highest winning bid of ₹${lockedListing.currentPricePaise / 100} on "${lockedListing.title}".\n📍 Campus Pickup Point: ${pickupPoint}\n📞 Seller Phone: ${sellerPhone}`,
            data: {
              listingId: lockedListing._id.toString(),
              saleId: sale._id.toString(),
              finalPricePaise: lockedListing.currentPricePaise,
              pickupPoint,
              sellerPhone,
              sellerName: seller?.displayName || 'Seller',
            },
            eventKey: `won_${lockedListing._id}_${lockedListing.currentPricePaise}`,
          });

          notifications.push({
            recipientId: lockedListing.sellerId.toString(),
            type: 'SALE_APPROVAL',
            listingId: lockedListing._id.toString(),
            saleId: sale._id.toString(),
            message: `Auction for "${lockedListing.title}" ended with winning bid of ₹${lockedListing.currentPricePaise / 100}. Handover pickup point: ${pickupPoint}. Please approve or reject to arrange campus handover.`,
            data: {
              listingId: lockedListing._id.toString(),
              saleId: sale._id.toString(),
              finalPricePaise: lockedListing.currentPricePaise,
              pickupPoint,
              sellerPhone,
            },
            eventKey: `sale_approval_${lockedListing._id}`,
          });
        } else {
          notifications.push({
            recipientId: lockedListing.sellerId.toString(),
            type: 'AUCTION_CLOSED_SELLER',
            listingId: lockedListing._id.toString(),
            message: `Auction for "${lockedListing.title}" ended without any bids. You may re-list the item at any time.`,
            eventKey: `unsold_${lockedListing._id}`,
          });
        }
      });

      if (broadcastPayload) {
        emitAuctionUpdate(listing._id.toString(), 'auction:closed', broadcastPayload);
        closedCount += 1;
      }

      // Dispatch notifications outside the transaction
      for (const n of notifications) {
        await createNotification(n);
      }
    } catch (err) {
      console.error(`Error closing auction ${listing._id}:`, err);
    }
  }

  return { closedCount };
}
