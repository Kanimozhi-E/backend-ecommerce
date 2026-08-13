const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const updateProductRatingAggregate = async (productId) => {
  const allReviews = await Review.find({ product: productId });
  const count = allReviews.length;
  const avgRating = count > 0
    ? Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
    : 0;

  await Product.findByIdAndUpdate(productId, {
    numReviews: count,
    rating: avgRating
  });

  return { numReviews: count, rating: avgRating };
};

// @desc    Create a product review (Requires eligible purchase check)
// @route   POST /api/reviews
// @access  Private
exports.createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment, images } = req.body;

    const product = await Product.findById(productId);
    if (!product) return sendError(res, 404, 'Product not found');

    // Check if user already reviewed
    const existingReview = await Review.findOne({ user: req.user.id, product: productId });
    if (existingReview) {
      return sendError(res, 400, 'You have already submitted a review for this product');
    }

    // Check if eligible verified purchase
    const userOrder = await Order.findOne({
      user: req.user.id,
      'orderItems.product': productId,
      isPaid: true
    });
    const verifiedPurchase = Boolean(userOrder);

    const review = await Review.create({
      user: req.user.id,
      product: productId,
      userName: req.user.name,
      rating: Number(rating),
      comment,
      images: Array.isArray(images) ? images : [],
      verifiedPurchase
    });

    const aggregate = await updateProductRatingAggregate(productId);

    return sendSuccess(res, 201, 'Review created successfully', {
      review,
      productRating: aggregate.rating,
      numReviews: aggregate.numReviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit user's review
// @route   PUT /api/reviews/:id
// @access  Private
exports.updateReview = async (req, res, next) => {
  try {
    const { rating, comment, images } = req.body;

    const review = await Review.findById(req.params.id);
    if (!review) return sendError(res, 404, 'Review not found');

    // Check ownership
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 403, 'Not authorized to edit this review');
    }

    if (rating !== undefined) review.rating = Number(rating);
    if (comment !== undefined) review.comment = comment;
    if (images !== undefined) review.images = Array.isArray(images) ? images : [];

    await review.save();

    const aggregate = await updateProductRatingAggregate(review.product);

    return sendSuccess(res, 200, 'Review updated successfully', {
      review,
      productRating: aggregate.rating,
      numReviews: aggregate.numReviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user's review
// @route   DELETE /api/reviews/:id
// @access  Private
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return sendError(res, 404, 'Review not found');

    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 403, 'Not authorized to delete this review');
    }

    const productId = review.product;
    await review.deleteOne();

    const aggregate = await updateProductRatingAggregate(productId);

    return sendSuccess(res, 200, 'Review deleted successfully', {
      productRating: aggregate.rating,
      numReviews: aggregate.numReviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews & rating distribution for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
exports.getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    const count = reviews.length;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    reviews.forEach(r => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      distribution[star] = (distribution[star] || 0) + 1;
      sum += r.rating;
    });

    const averageRating = count > 0 ? Number((sum / count).toFixed(1)) : 0;

    return sendSuccess(res, 200, 'Reviews retrieved', {
      reviews,
      totalReviews: count,
      averageRating,
      distribution
    });
  } catch (error) {
    next(error);
  }
};
