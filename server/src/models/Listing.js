import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'CYCLES',
        'TEXTBOOKS',
        'ELECTRONICS',
        'LAB_EQUIPMENT',
        'FURNITURE',
        'CALCULATORS',
        'OTHER',
      ],
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    condition: {
      type: String,
      required: true,
      enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'],
      index: true,
    },
    images: [
      {
        publicId: { type: String, required: true },
        secureUrl: { type: String, required: true },
        order: { type: Number, default: 0 },
      },
    ],
    startingPricePaise: {
      type: Number,
      required: true,
      min: 100, // min ₹1
      validate: {
        validator: Number.isInteger,
        message: 'startingPricePaise must be an integer',
      },
    },
    minBidIncrementPaise: {
      type: Number,
      required: true,
      min: 100,
      default: 5000, // ₹50 default
      validate: {
        validator: Number.isInteger,
        message: 'minBidIncrementPaise must be an integer',
      },
    },
    currentPricePaise: {
      type: Number,
      required: true,
      min: 100,
      validate: {
        validator: Number.isInteger,
        message: 'currentPricePaise must be an integer',
      },
      index: true,
    },
    leadingBidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bidCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXTENDED', 'CLOSED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    pickupPoint: {
      type: String,
      trim: true,
      default: 'Campus Central Library / Student Activity Center',
      maxlength: 150,
    },
    sellerPhone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 30,
    },
    closingAt: {
      type: Date,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant query patterns
listingSchema.index({ status: 1, closingAt: 1 });
listingSchema.index({ category: 1, status: 1, currentPricePaise: 1 });
listingSchema.index({ condition: 1, status: 1 });
listingSchema.index({ title: 'text', description: 'text' });

export const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);
