const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsersAdmin,
  updateUserRoleAdmin,
  deleteUserAdmin
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect, adminOnly);

router.get('/dashboard', getDashboardStats);

router.get('/users', getAllUsersAdmin);
router.put('/users/:id/role', updateUserRoleAdmin);
router.delete('/users/:id', deleteUserAdmin);

module.exports = router;
