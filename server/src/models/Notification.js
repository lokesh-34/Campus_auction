import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'OUTBID',
        'CLOSING_SOON',
        'AUCTION_WON',
        'AUCTION_CLOSED_SELLER',
        'SALE_APPROVAL',
        'SALE_REJECTED',
        'RESERVATION_ACTIVE',
        'HANDOVER_CONFIRMED',
        'SALE_CANCELLED',
        'NEW_QUESTION',
        'QUESTION_ANSWERED',
        'SAVED_SEARCH_MATCH',
      ],
      index: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      default: null,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    eventKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Event deduplication per recipient
notificationSchema.index({ recipientId: 1, eventKey: 1 }, { unique: true });
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
