const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  applyCoupon,
  removeCoupon,
  clearCart
} = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCartQuantity);
router.delete('/item/:itemId', removeFromCart);
router.post('/coupon', applyCoupon);
router.delete('/coupon', removeCoupon);
router.delete('/clear', clearCart);

module.exports = router;
