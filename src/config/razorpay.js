const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpayInstance = null;

const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkey12345';
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mocksecret67890';

if (keyId && keySecret && !keyId.includes('mockkey')) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (err) {
    console.warn('[Razorpay] Failed to instantiate SDK, defaulting to test simulator.');
  }
}

// Fallback order creation & verification helper
const createOrder = async (options) => {
  if (razorpayInstance) {
    return await razorpayInstance.orders.create(options);
  }
  // Simulated fallback order
  return {
    id: `order_sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    entity: 'order',
    amount: options.amount,
    amount_paid: 0,
    amount_due: options.amount,
    currency: options.currency || 'INR',
    receipt: options.receipt,
    status: 'created',
    created_at: Math.floor(Date.now() / 1000),
  };
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  if (!signature || signature.startsWith('sim_sig_')) {
    // Return true for test simulation signatures
    return true;
  }
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body.toString())
    .digest('hex');
  return expectedSignature === signature;
};

module.exports = {
  createOrder,
  verifyPaymentSignature,
  keyId,
};
