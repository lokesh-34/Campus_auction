import mongoose from 'mongoose';

const autoBidSchema = new mongoose.Schema(
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
    maxAmountPaise: {
      type: Number,
      required: true,
      min: 100,
      validate: {
        validator: Number.isInteger,
        message: 'maxAmountPaise must be an integer',
      },
      // PRIVATE: Never expose in public API responses or Socket.IO events
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce single active autobid per user per listing
autoBidSchema.index({ listingId: 1, bidderId: 1 }, { unique: true });

export const AutoBid =
  mongoose.models.AutoBid || mongoose.model('AutoBid', autoBidSchema);
