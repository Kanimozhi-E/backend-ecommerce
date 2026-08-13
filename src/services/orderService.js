const Product = require('../models/Product');
const { createOrder, verifyPaymentSignature } = require('../config/razorpay');

/**
 * Service to process cart items, calculate server-verified pricing and tax, and create Razorpay Order
 */
const prepareOrderPayment = async (cartItems, shippingAddress) => {
  let itemsPrice = 0;
  const verifiedOrderItems = [];

  for (const item of cartItems) {
    const product = await Product.findById(item.product._id || item.product);
    if (!product) {
      throw new Error(`Product no longer exists in catalog`);
    }
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient inventory stock for ${product.title}`);
    }

    const unitPrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;
    itemsPrice += unitPrice * item.quantity;

    verifiedOrderItems.push({
      product: product._id,
      title: product.title,
      image: product.images[0] || '',
      variantName: item.variantName || '',
      price: unitPrice,
      quantity: item.quantity
    });
  }

  const taxPrice = Math.round(itemsPrice * 0.18);
  const shippingPrice = itemsPrice > 1000 ? 0 : 50;

  return {
    verifiedOrderItems,
    itemsPrice,
    taxPrice,
    shippingPrice
  };
};

module.exports = {
  prepareOrderPayment,
  createRazorpayOrder: createOrder,
  verifyPaymentSignature
};
