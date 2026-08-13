const Wishlist = require('../models/Wishlist');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id }).populate({
      path: 'products',
      populate: { path: 'category', select: 'name slug' }
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.id, products: [] });
    }

    return sendSuccess(res, 200, 'Wishlist retrieved', { wishlist });
  } catch (error) {
    next(error);
  }
};

exports.toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!productId) return sendError(res, 400, 'Product ID is required');

    let wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.id, products: [] });
    }

    const index = wishlist.products.indexOf(productId);
    let added = false;

    if (index > -1) {
      wishlist.products.splice(index, 1);
    } else {
      wishlist.products.push(productId);
      added = true;
    }

    await wishlist.save();
    const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products');

    return sendSuccess(
      res,
      200,
      added ? 'Added to wishlist' : 'Removed from wishlist',
      { wishlist: updatedWishlist, inWishlist: added }
    );
  } catch (error) {
    next(error);
  }
};

// Move item from Wishlist to Cart
exports.moveToCart = async (req, res, next) => {
  try {
    const { productId, variantName = '' } = req.body;
    if (!productId) return sendError(res, 400, 'Product ID is required');

    const product = await Product.findById(productId);
    if (!product) {
      return sendError(res, 404, 'Product no longer exists');
    }

    if (product.stock <= 0) {
      return sendError(res, 400, 'Product is currently out of stock');
    }

    const itemPrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;

    // Add to cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });

    const existingIdx = cart.items.findIndex(
      item => item.product.toString() === productId && item.variantName === variantName
    );

    if (existingIdx > -1) {
      cart.items[existingIdx].quantity += 1;
    } else {
      cart.items.push({
        product: productId,
        variantName,
        quantity: 1,
        price: itemPrice
      });
    }
    await cart.save();

    // Remove from wishlist
    let wishlist = await Wishlist.findOne({ user: req.user.id });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(p => p.toString() !== productId);
      await wishlist.save();
    }

    const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products');
    const updatedCart = await Cart.findById(cart._id).populate('items.product');

    return sendSuccess(res, 200, 'Item moved from wishlist to cart', {
      wishlist: updatedWishlist,
      cart: updatedCart
    });
  } catch (error) {
    next(error);
  }
};
