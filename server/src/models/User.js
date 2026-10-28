import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      // Private: never exposed in public seller responses
    },
    profileImage: {
      publicId: { type: String },
      secureUrl: { type: String },
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
    },
    watchlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
      },
    ],
    notificationPreferences: {
      outbid: { type: Boolean, default: true },
      closingSoon: { type: Boolean, default: true },
      saleUpdates: { type: Boolean, default: true },
      browserAlerts: { type: Boolean, default: false },
    },
    stats: {
      completedSales: { type: Number, default: 0, min: 0 },
      ratingCount: { type: Number, default: 0, min: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    displayName: this.displayName,
    profileImage: this.profileImage,
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
