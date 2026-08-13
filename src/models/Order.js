const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  title: { type: String, required: true },
  image: { type: String },
  variantName: { type: String, default: '' },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true }
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    orderItems: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' }
    },
    paymentMethod: {
      type: String,
      required: true,
      default: 'Razorpay'
    },
    paymentResult: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      status: { type: String, default: 'Pending' }
    },
    paymentId: {
      type: String,
      default: function() { return this.paymentResult?.razorpayPaymentId || ''; }
    },
    itemsPrice: { type: Number, required: true, default: 0 },
    subtotal: {
      type: Number,
      default: function() { return this.itemsPrice; }
    },
    taxPrice: { type: Number, required: true, default: 0 },
    tax: {
      type: Number,
      default: function() { return this.taxPrice; }
    },
    shippingPrice: { type: Number, required: true, default: 0 },
    shippingFee: {
      type: Number,
      default: function() { return this.shippingPrice; }
    },
    discountAmount: { type: Number, default: 0 },
    discount: {
      type: Number,
      default: function() { return this.discountAmount; }
    },
    totalPrice: { type: Number, required: true, default: 0 },
    total: {
      type: Number,
      default: function() { return this.totalPrice; }
    },
    isPaid: { type: Boolean, default: false },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
      default: 'Pending'
    },
    paidAt: { type: Date },
    // Order Lifecycle States: PLACED → CONFIRMED → PROCESSING → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
    orderStatus: {
      type: String,
      enum: [
        'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
        'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Cancellation Requested', 'Return Requested', 'Refunded'
      ],
      default: 'PLACED',
      index: true
    },
    // Return Lifecycle States: REQUESTED → APPROVED/REJECTED → PICKUP → RECEIVED → REFUND_INITIATED → COMPLETED
    returnStatus: {
      type: String,
      enum: ['NOT_REQUESTED', 'REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP', 'RECEIVED', 'REFUND_INITIATED', 'COMPLETED'],
      default: 'NOT_REQUESTED',
      index: true
    },
    refundDetails: {
      refundAmount: { type: Number, default: 0 },
      refundId: { type: String, default: '' },
      refundStatus: {
        type: String,
        enum: ['Not Applicable', 'Pending Admin Approval', 'Approved', 'Refund Processed', 'Rejected'],
        default: 'Not Applicable'
      },
      refundedAt: { type: Date },
      adminNote: { type: String, default: '' }
    },
    trackingNumber: { type: String, default: '', index: true },
    cancellationReason: { type: String, default: '' },
    returnReason: { type: String, default: '' }
  },
  { timestamps: true }
);

// Synced virtual fields
orderSchema.pre('save', function (next) {
  this.subtotal = this.itemsPrice;
  this.tax = this.taxPrice;
  this.shippingFee = this.shippingPrice;
  this.discount = this.discountAmount;
  this.total = this.totalPrice;
  if (this.paymentResult?.razorpayPaymentId) {
    this.paymentId = this.paymentResult.razorpayPaymentId;
  }
  if (this.isPaid && this.paymentStatus !== 'Refunded') {
    this.paymentStatus = 'Completed';
  }
  next();
});

orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
