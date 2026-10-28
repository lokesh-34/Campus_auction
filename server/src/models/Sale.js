import mongoose from 'mongoose';
import crypto from 'crypto';

const saleSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      unique: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    finalPricePaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'finalPricePaise must be an integer',
      },
    },
    outcome: {
      type: String,
      enum: [
        'UNSOLD',
        'PENDING_SELLER_APPROVAL',
        'REJECTED',
        'RESERVED',
        'SOLD',
        'SELLER_CANCELLED',
        'FAILED_PICKUP',
      ],
      required: true,
      default: 'PENDING_SELLER_APPROVAL',
      index: true,
    },
    sellerDecisionAt: {
      type: Date,
    },
    reservationExpiresAt: {
      type: Date,
    },
    // Dynamic In-Person Handover Verification
    handoverOtp: {
      type: String,
      trim: true,
      maxlength: 6,
    },
    handoverOtpCreatedAt: {
      type: Date,
    },
    handoverOtpExpiresAt: {
      type: Date,
    },
    handoverVerifiedVia: {
      type: String,
      enum: ['OTP', 'QR', 'MANUAL'],
      default: 'OTP',
    },
    handoverAttempts: {
      type: Number,
      default: 0,
    },
    handoverConfirmedSellerAt: {
      type: Date,
    },
    handoverConfirmedBuyerAt: {
      type: Date,
    },
    handoverCompletedAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    pickupPoint: {
      type: String,
      trim: true,
      default: '',
    },
    sellerPhone: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.methods.generateHandoverOtp = function () {
  const randomInt = crypto.randomInt(100000, 1000000);
  this.handoverOtp = randomInt.toString();
  this.handoverOtpCreatedAt = new Date();
  this.handoverOtpExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  this.handoverAttempts = 0;
  return this.handoverOtp;
};

saleSchema.index({ sellerId: 1, outcome: 1 });
saleSchema.index({ winnerId: 1, outcome: 1 });

export const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema);
