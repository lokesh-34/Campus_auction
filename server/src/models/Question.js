import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    answerText: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['OPEN', 'ANSWERED', 'REMOVED'],
      default: 'OPEN',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ listingId: 1, createdAt: -1 });

export const Question =
  mongoose.models.Question || mongoose.model('Question', questionSchema);
