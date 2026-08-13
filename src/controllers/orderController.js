const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const { createOrder, verifyPaymentSignature, keyId } = require('../config/razorpay');
const { sendSuccess, sendError } = require('../utils/responseHandler');

// @desc    Step 1 to 4: Create Pending MongoDB Order & Razorpay Payment Order
// @route   POST /api/orders/razorpay-order
// @access  Private
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { shippingAddress } = req.body;

    if (!shippingAddress) {
      return sendError(res, 400, 'Shipping address is required');
    }

    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return sendError(res, 400, 'Your cart is empty');
    }

    let itemsPrice = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        return sendError(res, 404, `Product "${item.product.title}" no longer exists`);
      }
      if (product.stock < item.quantity) {
        return sendError(res, 400, `Insufficient stock for ${product.title}`);
      }

      const itemPrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;
      itemsPrice += itemPrice * item.quantity;

      orderItems.push({
        product: product._id,
        title: product.title,
        image: product.images[0] || '',
        variantName: item.variantName || '',
        price: itemPrice,
        quantity: item.quantity
      });
    }

    const taxPrice = Math.round(itemsPrice * 0.18);
    const shippingPrice = itemsPrice > 1000 ? 0 : 50;
    const discountAmount = cart.discountAmount || 0;
    const totalPrice = Math.max(0, itemsPrice + taxPrice + shippingPrice - discountAmount);

    const options = {
      amount: Math.round(totalPrice * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const razorpayOrder = await createOrder(options);

    const pendingOrder = await Order.create({
      user: req.user.id,
      orderItems,
      shippingAddress,
      paymentMethod: 'Razorpay',
      paymentResult: {
        razorpayOrderId: razorpayOrder.id,
        status: 'Pending'
      },
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountAmount,
      totalPrice,
      isPaid: false,
      paymentStatus: 'Pending',
      orderStatus: 'PLACED',
      returnStatus: 'NOT_REQUESTED',
      trackingNumber: `TRK${Math.floor(10000000 + Math.random() * 90000000)}`
    });

    return sendSuccess(res, 200, 'Order initialized', {
      orderId: pendingOrder._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId,
      summary: {
        orderItems,
        shippingAddress,
        itemsPrice,
        taxPrice,
        shippingPrice,
        discountAmount,
        totalPrice
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Step 7 to 10: Verify Razorpay HMAC Signature & Confirm Order
// @route   POST /api/orders/verify-payment
// @access  Private
exports.verifyPaymentAndCreateOrder = async (req, res, next) => {
  try {
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      shippingAddress
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return sendError(res, 400, 'Missing Razorpay payment verification parameters');
    }

    let order = null;
    if (orderId) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ 'paymentResult.razorpayOrderId': razorpayOrderId });
    }

    if (order && order.isPaid) {
      return sendSuccess(res, 200, 'Payment already verified', { order });
    }

    const isValidSignature = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValidSignature) {
      if (order) {
        order.paymentStatus = 'Failed';
        await order.save();
      }
      return sendError(res, 400, 'Invalid payment signature.');
    }

    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

    if (order) {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
      }

      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentStatus = 'Completed';
      order.orderStatus = 'CONFIRMED';
      order.paymentResult = {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: razorpaySignature || 'simulated',
        status: 'Completed'
      };
      await order.save();
    }

    if (cart) {
      cart.items = [];
      cart.couponCode = null;
      cart.discountAmount = 0;
      await cart.save();
    }

    // Multi-factor Subscriber Reward Engine: Product Price, Item Quantity & Order Frequency Count
    const currentUser = await User.findById(req.user.id);
    let rewardCouponCode = null;

    if (currentUser) {
      currentUser.orderCount = (currentUser.orderCount || 0) + 1;
      currentUser.totalSpent = (currentUser.totalSpent || 0) + (order?.totalPrice || 0);

      const lifetimeOrders = currentUser.orderCount;
      const currentOrderPrice = order?.totalPrice || 0;
      const currentItemQty = order?.orderItems ? order.orderItems.reduce((sum, i) => sum + i.quantity, 0) : 1;

      let discountVal = 15;
      let maxDiscountCap = 500;
      let rewardTitle = '';
      let rewardMsg = '';

      // Tier 1: High-Value VIP Lifetime Order Milestone (>= 5 orders OR order price >= 3000)
      if (lifetimeOrders >= 5 || currentOrderPrice >= 3000) {
        rewardCouponCode = `VIP${Math.floor(100 + Math.random() * 900)}`;
        discountVal = 30;
        maxDiscountCap = 2000;
        rewardTitle = `👑 Platinum VIP Subscriber Reward (${lifetimeOrders} orders & ₹${currentOrderPrice} spent)!`;
        rewardMsg = `You unlocked VIP Coupon ${rewardCouponCode} for 30% OFF (up to ₹2,000)!`;
      }
      // Tier 2: Bulk Purchase & High Product Price (3+ items at a time OR order price >= 1500)
      else if (currentItemQty >= 3 || currentOrderPrice >= 1500) {
        rewardCouponCode = `BULK${Math.floor(100 + Math.random() * 900)}`;
        discountVal = 25;
        maxDiscountCap = 1200;
        rewardTitle = `⚡ Bulk & High-Value Order Reward (${currentItemQty} items in order)!`;
        rewardMsg = `You unlocked Bulk Coupon ${rewardCouponCode} for 25% OFF (up to ₹1,200)!`;
      }
      // Tier 3: Frequency Repeat Order Milestone (2+ lifetime orders)
      else if (lifetimeOrders >= 2) {
        rewardCouponCode = `REWARD${Math.floor(100 + Math.random() * 900)}`;
        discountVal = 20;
        maxDiscountCap = 800;
        rewardTitle = `🎁 Repeat Subscriber Reward (${lifetimeOrders} orders completed)!`;
        rewardMsg = `You unlocked Frequency Coupon ${rewardCouponCode} for 20% OFF!`;
      }

      if (rewardCouponCode) {
        // Save to global Coupon collection
        await Coupon.create({
          code: rewardCouponCode,
          discountType: 'percentage',
          discountValue: discountVal,
          minOrderAmount: 300,
          maxDiscount: maxDiscountCap,
          expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          isActive: true
        });

        // Add to user's personal earnedCoupons array
        currentUser.earnedCoupons.push({
          code: rewardCouponCode,
          discountValue: discountVal,
          minOrderAmount: 300,
          maxDiscount: maxDiscountCap,
          description: rewardMsg,
          createdAt: new Date()
        });

        await currentUser.save();

        await Notification.create({
          user: req.user.id,
          title: rewardTitle,
          message: rewardMsg,
          type: 'order',
          link: '/cart'
        });
      } else {
        await currentUser.save();
      }
    }

    await Notification.create({
      user: req.user.id,
      title: 'Order Confirmed & Paid!',
      message: `Your order #${order._id.toString().slice(-6)} has been confirmed! Tracking #: ${order.trackingNumber}`,
      type: 'order',
      link: `/orders/${order._id}`
    });

    return sendSuccess(res, 201, 'Payment verified and order confirmed', {
      order,
      rewardCoupon: rewardCouponCode
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Orders retrieved', { orders });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    if (!order) {
      return sendError(res, 404, 'Order not found');
    }

    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 403, 'Not authorized to view this order');
    }

    return sendSuccess(res, 200, 'Order retrieved', { order });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer Cancel Order (Eligible if status is PLACED, CONFIRMED, PROCESSING)
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return sendError(res, 404, 'Order not found');

    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 403, 'Not authorized');
    }

    const currentUpper = (order.orderStatus || '').toUpperCase();
    const cancellableStatuses = ['PLACED', 'CONFIRMED', 'PROCESSING', 'PENDING'];

    if (!cancellableStatuses.includes(currentUpper)) {
      return sendError(res, 400, `Cannot cancel order after it has entered ${order.orderStatus} status`);
    }

    order.orderStatus = 'CANCELLED';
    order.cancellationReason = reason || 'Cancelled by customer';
    order.refundDetails = {
      refundAmount: order.totalPrice,
      refundId: `REF_${Math.floor(10000000 + Math.random() * 90000000)}`,
      refundStatus: 'Approved',
      refundedAt: Date.now(),
      adminNote: 'Cancelled by customer before shipment. Full refund processed.'
    };

    await order.save();

    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }

    await Notification.create({
      user: order.user,
      title: 'Order Cancelled',
      message: `Your order #${order._id.toString().slice(-6)} has been cancelled. Refund of ₹${order.totalPrice} initiated to original payment method.`,
      type: 'order',
      link: `/orders/${order._id}`
    });

    return sendSuccess(res, 200, 'Order cancelled successfully', { order });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer Request Return for Delivered Products
// @route   PUT /api/orders/:id/return
// @access  Private
exports.requestReturn = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return sendError(res, 404, 'Order not found');

    if (order.user.toString() !== req.user.id) {
      return sendError(res, 403, 'Not authorized');
    }

    const currentUpper = (order.orderStatus || '').toUpperCase();
    if (currentUpper !== 'DELIVERED') {
      return sendError(res, 400, 'Return request can only be submitted for delivered products');
    }

    order.returnStatus = 'REQUESTED';
    order.returnReason = reason || 'Item damaged / Defective product';
    order.refundDetails = {
      refundAmount: order.totalPrice,
      refundId: `REF_${Math.floor(10000000 + Math.random() * 90000000)}`,
      refundStatus: 'Pending Admin Approval',
      adminNote: 'Return request submitted by customer. Pending admin approval.'
    };

    await order.save();

    await Notification.create({
      user: order.user,
      title: 'Return Request Submitted',
      message: `Return request submitted for order #${order._id.toString().slice(-6)}. Status: REQUESTED.`,
      type: 'order',
      link: `/orders/${order._id}`
    });

    return sendSuccess(res, 200, 'Return request submitted successfully', { order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Approve Refund / Cashback
// @route   PUT /api/orders/:id/approve-refund
// @access  Private/Admin
exports.approveRefundAdmin = async (req, res, next) => {
  try {
    const { approve = true, adminNote } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return sendError(res, 404, 'Order not found');

    if (!approve) {
      order.returnStatus = 'REJECTED';
      order.refundDetails.refundStatus = 'Rejected';
      order.refundDetails.adminNote = adminNote || 'Rejected by Admin.';
      await order.save();
      return sendSuccess(res, 200, 'Refund request rejected', { order });
    }

    order.returnStatus = 'APPROVED';
    order.refundDetails.refundStatus = 'Refund Processed';
    order.refundDetails.refundedAt = Date.now();
    order.refundDetails.adminNote = adminNote || 'Approved by Admin.';
    await order.save();

    return sendSuccess(res, 200, 'Refund approved', { order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update Order Fulfillment Lifecycle Status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatusAdmin = async (req, res, next) => {
  try {
    const { orderStatus, trackingNumber } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return sendError(res, 404, 'Order not found');

    order.orderStatus = orderStatus || order.orderStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    if (orderStatus === 'DELIVERED' || orderStatus === 'Delivered') {
      order.isPaid = true;
      order.paymentStatus = 'Completed';
    }

    await order.save();

    await Notification.create({
      user: order.user,
      title: `Shipment Update: ${order.orderStatus}`,
      message: `Your order #${order._id.toString().slice(-6)} is now ${order.orderStatus}. Tracking #: ${order.trackingNumber}`,
      type: 'order',
      link: `/orders/${order._id}`
    });

    return sendSuccess(res, 200, 'Order status updated successfully', { order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update Return Lifecycle Status
// @route   PUT /api/orders/:id/return-status
// @access  Private/Admin
exports.updateReturnStatusAdmin = async (req, res, next) => {
  try {
    const { returnStatus, adminNote } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return sendError(res, 404, 'Order not found');

    const prevReturnStatus = order.returnStatus;
    order.returnStatus = returnStatus;

    if (adminNote) {
      order.refundDetails.adminNote = adminNote;
    }

    if (returnStatus === 'APPROVED') {
      order.refundDetails.refundStatus = 'Approved';
    } else if (returnStatus === 'REJECTED') {
      order.refundDetails.refundStatus = 'Rejected';
    } else if (returnStatus === 'REFUND_INITIATED') {
      order.refundDetails.refundStatus = 'Approved';
    } else if (returnStatus === 'COMPLETED' || returnStatus === 'RECEIVED') {
      order.orderStatus = 'CANCELLED';
      order.paymentStatus = 'Refunded';
      order.refundDetails.refundStatus = 'Refund Processed';
      order.refundDetails.refundedAt = Date.now();

      if (prevReturnStatus !== 'COMPLETED' && prevReturnStatus !== 'RECEIVED') {
        for (const item of order.orderItems) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
      }
    }

    await order.save();

    await Notification.create({
      user: order.user,
      title: `Return Status Update: ${returnStatus}`,
      message: `Your return request for order #${order._id.toString().slice(-6)} is now ${returnStatus}.`,
      type: 'order',
      link: `/orders/${order._id}`
    });

    return sendSuccess(res, 200, 'Return status updated', { order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getAllOrdersAdmin = async (req, res, next) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'All orders retrieved', { orders });
  } catch (error) {
    next(error);
  }
};
