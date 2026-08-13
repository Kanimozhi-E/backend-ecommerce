const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllReviewsAdmin,
  deleteReviewAdmin
} = require('../controllers/productController');
const { protect, adminOnly, sellerOrAdmin } = require('../middleware/authMiddleware');
const { validateProduct } = require('../middleware/validate');

router.route('/')
  .get(getProducts)
  .post(protect, sellerOrAdmin, validateProduct, createProduct);

router.get('/reviews/admin/all', protect, adminOnly, getAllReviewsAdmin);
router.delete('/reviews/admin/:id', protect, adminOnly, deleteReviewAdmin);

router.get('/:id/related', getRelatedProducts);

router.route('/:idOrSlug')
  .get(getProductById);

router.route('/:id')
  .put(protect, sellerOrAdmin, updateProduct)
  .delete(protect, adminOnly, deleteProduct);

module.exports = router;
