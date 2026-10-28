import mongoose from 'mongoose';

const savedSearchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    keyword: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
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
    maxPricePaise: {
      type: Number,
      min: 0,
      validate: {
        validator: (v) => v == null || Number.isInteger(v),
        message: 'maxPricePaise must be an integer',
      },
    },
    condition: {
      type: String,
      enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'],
    },
    notifyEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SavedSearch =
  mongoose.models.SavedSearch || mongoose.model('SavedSearch', savedSearchSchema);
