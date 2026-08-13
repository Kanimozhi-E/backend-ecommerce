const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyPaymentAndCreateOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
  approveRefundAdmin,
  getAllOrdersAdmin,
  updateOrderStatusAdmin,
  updateReturnStatusAdmin
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/razorpay-order', createRazorpayOrder);
router.post('/verify-payment', verifyPaymentAndCreateOrder);
router.get('/myorders', getMyOrders);
router.get('/admin/all', adminOnly, getAllOrdersAdmin);
router.get('/:id', getOrderById);
router.put('/:id/cancel', cancelOrder);
router.put('/:id/return', requestReturn);
router.put('/:id/approve-refund', adminOnly, approveRefundAdmin);
router.put('/:id/status', adminOnly, updateOrderStatusAdmin);
router.put('/:id/return-status', adminOnly, updateReturnStatusAdmin);

module.exports = router;
