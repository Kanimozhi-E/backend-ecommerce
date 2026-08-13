const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

// Helper to compute subtotal and totals
const calculateCartTotals = (cart) => {
  const subtotal = cart.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  let discount = cart.discountAmount || 0;
  if (discount > subtotal) {
    discount = subtotal;
  }
  const total = Math.max(0, subtotal - discount);

  return { subtotal, discount, total };
};

exports.getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    const totals = calculateCartTotals(cart);

    return sendSuccess(res, 200, 'Cart retrieved', {
      cart,
      totals
    });
  } catch (error) {
    next(error);
  }
};

exports.addToCart = async (req, res, next) => {
  try {
    const { productId, variantName = '', quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return sendError(res, 404, 'Product not found');
    }

    if (product.stock < quantity) {
      return sendError(res, 400, 'Insufficient stock available');
    }

    // Determine final item price
    let itemPrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;

    const cart = await getOrCreateCart(req.user.id);

    // Check if product with same variant is already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product._id.toString() === productId && item.variantName === variantName
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += Number(quantity);
    } else {
      cart.items.push({
        product: productId,
        variantName,
        quantity: Number(quantity),
        price: itemPrice
      });
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    const totals = calculateCartTotals(updatedCart);

    return sendSuccess(res, 200, 'Product added to cart', {
      cart: updatedCart,
      totals
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCartQuantity = async (req, res, next) => {
  try {
    const { itemId, quantity } = req.body;

    const cart = await getOrCreateCart(req.user.id);
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return sendError(res, 404, 'Item not found in cart');
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    const totals = calculateCartTotals(updatedCart);

    return sendSuccess(res, 200, 'Cart item updated', {
      cart: updatedCart,
      totals
    });
  } catch (error) {
    next(error);
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const cart = await getOrCreateCart(req.user.id);
    cart.items = cart.items.filter(item => item._id.toString() !== itemId);

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    const totals = calculateCartTotals(updatedCart);

    return sendSuccess(res, 200, 'Item removed from cart', {
      cart: updatedCart,
      totals
    });
  } catch (error) {
    next(error);
  }
};

exports.applyCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return sendError(res, 400, 'Coupon code is required');

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return sendError(res, 404, 'Invalid or expired coupon code');

    if (coupon.expirationDate < new Date()) {
      return sendError(res, 400, 'Coupon has expired');
    }

    const cart = await getOrCreateCart(req.user.id);
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (subtotal < coupon.minOrderAmount) {
      return sendError(res, 400, `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`);
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    cart.couponCode = coupon.code;
    cart.discountAmount = discount;
    await cart.save();

    const totals = calculateCartTotals(cart);

    return sendSuccess(res, 200, 'Coupon applied successfully', {
      cart,
      totals,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.removeCoupon = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.couponCode = null;
    cart.discountAmount = 0;
    await cart.save();

    const totals = calculateCartTotals(cart);

    return sendSuccess(res, 200, 'Coupon removed', { cart, totals });
  } catch (error) {
    next(error);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.items = [];
    cart.couponCode = null;
    cart.discountAmount = 0;
    await cart.save();

    return sendSuccess(res, 200, 'Cart cleared', { cart });
  } catch (error) {
    next(error);
  }
};
