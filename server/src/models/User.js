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
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: 30,
    },
    pickupPoint: {
      type: String,
      trim: true,
      default: '',
      maxlength: 150,
    },
    // Campus Academic & Verification Attributes
    department: {
      type: String,
      trim: true,
      default: 'Computer Science & Engineering',
      maxlength: 100,
    },
    year: {
      type: String,
      trim: true,
      default: '3rd Year',
      maxlength: 50,
    },
    studentId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 50,
    },
    isVerifiedStudent: {
      type: Boolean,
      default: true,
    },
    verifiedEmailDomain: {
      type: String,
      trim: true,
      default: '@campus.edu',
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
      cancelledSales: { type: Number, default: 0, min: 0 },
      ratingCount: { type: Number, default: 0, min: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      karmaScore: { type: Number, default: 100, min: 0 },
      handoverRate: { type: Number, default: 100, min: 0, max: 100 },
      ghostingPenalties: { type: Number, default: 0, min: 0 },
      trustTier: {
        type: String,
        enum: ['NEW_TRADER', 'VERIFIED_STUDENT', 'TRUSTED_SELLER', 'ELITE_SELLER'],
        default: 'VERIFIED_STUDENT',
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.updateReputation = function (action) {
  if (!this.stats) {
    this.stats = {
      completedSales: 0,
      cancelledSales: 0,
      karmaScore: 100,
      handoverRate: 100,
      ghostingPenalties: 0,
      trustTier: 'VERIFIED_STUDENT',
    };
  }

  if (action === 'SALE_COMPLETED') {
    this.stats.completedSales = (this.stats.completedSales || 0) + 1;
    this.stats.karmaScore = (this.stats.karmaScore || 100) + 10;
  } else if (action === 'SALE_CANCELLED' || action === 'GHOSTED') {
    this.stats.cancelledSales = (this.stats.cancelledSales || 0) + 1;
    this.stats.ghostingPenalties = (this.stats.ghostingPenalties || 0) + 1;
    this.stats.karmaScore = Math.max(0, (this.stats.karmaScore || 100) - 25);
  }

  const totalConcluded = (this.stats.completedSales || 0) + (this.stats.cancelledSales || 0);
  if (totalConcluded > 0) {
    this.stats.handoverRate = Math.round(
      ((this.stats.completedSales || 0) / totalConcluded) * 100
    );
  } else {
    this.stats.handoverRate = 100;
  }

  if (this.stats.completedSales >= 10 && this.stats.handoverRate >= 95) {
    this.stats.trustTier = 'ELITE_SELLER';
  } else if (this.stats.completedSales >= 3 && this.stats.handoverRate >= 80) {
    this.stats.trustTier = 'TRUSTED_SELLER';
  } else if (this.isVerifiedStudent) {
    this.stats.trustTier = 'VERIFIED_STUDENT';
  } else {
    this.stats.trustTier = 'NEW_TRADER';
  }

  return this.stats;
};

userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    displayName: this.displayName,
    profileImage: this.profileImage,
    department: this.department,
    year: this.year,
    isVerifiedStudent: this.isVerifiedStudent,
    verifiedEmailDomain: this.verifiedEmailDomain,
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
