const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please add a coupon code'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    discountValue: {
      type: Number,
      required: [true, 'Please specify discount value'],
      min: 0
    },
    minOrderAmount: {
      type: Number,
      default: 0
    },
    minimumOrder: {
      type: Number,
      default: function() { return this.minOrderAmount; }
    },
    maxDiscount: {
      type: Number,
      default: null
    },
    maximumDiscount: {
      type: Number,
      default: function() { return this.maxDiscount; }
    },
    expirationDate: {
      type: Date,
      required: true,
      index: true
    },
    expiryDate: {
      type: Date,
      default: function() { return this.expirationDate; }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    active: {
      type: Boolean,
      default: function() { return this.isActive; }
    },
    usageLimit: {
      type: Number,
      default: 1000
    },
    usedCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

couponSchema.pre('save', function (next) {
  this.minimumOrder = this.minOrderAmount;
  this.maximumDiscount = this.maxDiscount;
  this.expiryDate = this.expirationDate;
  this.active = this.isActive;
  next();
});

module.exports = mongoose.model('Coupon', couponSchema);
