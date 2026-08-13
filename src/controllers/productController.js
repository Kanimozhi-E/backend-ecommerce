const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const { sendSuccess, sendError } = require('../utils/responseHandler');

// @desc    Get all products with server-side MongoDB filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      rating,
      discount,
      inStock,
      availability,
      sort = 'newest',
      page = 1,
      limit = 12,
      isFeatured
    } = req.query;

    const query = { isActive: { $ne: false } };

    // Multi-word tokenized search matching
    if (search && search.trim()) {
      const tokens = search.trim().split(/\s+/).filter(Boolean);
      const tokenQueries = tokens.map((token) => {
        const regex = new RegExp(token, 'i');
        return {
          $or: [
            { title: regex },
            { description: regex },
            { brand: regex },
            { tags: { $in: [regex] } }
          ]
        };
      });
      query.$and = tokenQueries;
    }

    if (category && category.trim()) {
      const cleanCat = category.trim();
      const isObjectId = Boolean(cleanCat.match(/^[0-9a-fA-F]{24}$/));
      const slugified = cleanCat.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const foundCategory = await Category.findOne({
        $or: [
          ...(isObjectId ? [{ _id: cleanCat }] : []),
          { slug: cleanCat },
          { slug: slugified },
          { name: new RegExp(cleanCat, 'i') },
          { name: new RegExp(cleanCat.replace('Wearables', 'Smart Wearables'), 'i') }
        ]
      });

      if (foundCategory) {
        query.category = foundCategory._id;
      }
    }

    if (brand) {
      query.brand = new RegExp(brand, 'i');
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice && Number(maxPrice) < 5000) query.price.$lte = Number(maxPrice);
      if (Object.keys(query.price).length === 0) delete query.price;
    }

    if (rating) {
      query.rating = { $gte: Number(rating) };
    }

    if (discount) {
      query.$or = [
        { discount: { $gte: Number(discount) } },
        { discountPrice: { $gt: 0 } }
      ];
    }

    if (inStock === 'true' || availability === 'in_stock') {
      query.stock = { $gt: 0 };
    }

    if (isFeatured === 'true') {
      query.isFeatured = true;
    }

    // Sort order mapping
    let sortOption = { createdAt: -1 };
    if (sort === 'price_low') sortOption = { price: 1 };
    else if (sort === 'price_high') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { rating: -1 };
    else if (sort === 'popular') sortOption = { numReviews: -1 };

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name slug image')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    return sendSuccess(res, 200, 'Products retrieved successfully', {
      products,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID or Slug
// @route   GET /api/products/:idOrSlug
// @access  Public
exports.getProductById = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const isObjectId = Boolean(idOrSlug.match(/^[0-9a-fA-F]{24}$/));

    const product = await Product.findOne({
      $or: [
        ...(isObjectId ? [{ _id: idOrSlug }] : []),
        { slug: idOrSlug }
      ]
    }).populate('category', 'name slug description image');

    if (!product) {
      return sendError(res, 404, 'Product not found');
    }

    return sendSuccess(res, 200, 'Product details retrieved', { product });
  } catch (error) {
    next(error);
  }
};

// @desc    Get related products by category or brand
// @route   GET /api/products/:id/related
// @access  Public
exports.getRelatedProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return sendError(res, 404, 'Product not found');
    }

    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: { $ne: false }
    }).limit(4);

    return sendSuccess(res, 200, 'Related products retrieved', { products: related });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews (Admin)
// @route   GET /api/products/reviews/admin/all
// @access  Private/Admin
exports.getAllReviewsAdmin = async (req, res, next) => {
  try {
    const reviews = await Review.find().populate('user', 'name email avatar').populate('product', 'title slug');
    return sendSuccess(res, 200, 'All reviews retrieved', { reviews });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review (Admin)
// @route   DELETE /api/products/reviews/admin/:id
// @access  Private/Admin
exports.deleteReviewAdmin = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return sendError(res, 404, 'Review not found');
    }
    return sendSuccess(res, 200, 'Review deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product (Admin)
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res, next) => {
  try {
    const productData = { ...req.body, seller: req.user._id };
    const product = await Product.create(productData);
    return sendSuccess(res, 201, 'Product created successfully', { product });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product (Admin)
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!product) {
      return sendError(res, 404, 'Product not found');
    }

    return sendSuccess(res, 200, 'Product updated successfully', { product });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (Admin)
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return sendError(res, 404, 'Product not found');
    }
    return sendSuccess(res, 200, 'Product deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
