const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    userName: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: [true, 'Please add a rating between 1 and 5'],
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: [true, 'Please add a review comment']
    },
    images: [
      {
        type: String
      }
    ],
    verifiedPurchase: {
      type: Boolean,
      default: false
    },
    helpfulCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Prevent duplicate reviews per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
