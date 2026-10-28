import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
    bidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'amountPaise must be an integer',
      },
    },
    source: {
      type: String,
      enum: ['MANUAL', 'AUTO'],
      default: 'MANUAL',
      required: true,
    },
    isWinning: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // append-only ledger
  }
);

bidSchema.index({ listingId: 1, createdAt: -1 });
bidSchema.index({ bidderId: 1, createdAt: -1 });
bidSchema.index({ listingId: 1, amountPaise: -1 });

export const Bid = mongoose.models.Bid || mongoose.model('Bid', bidSchema);
