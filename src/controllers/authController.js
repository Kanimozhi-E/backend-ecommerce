const crypto = require('crypto');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/responseHandler');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, 400, 'User with this email already exists');
    }

    const userRole = (role === 'admin' || role === 'seller') ? role : 'customer';

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: userRole
    });

    const token = user.getSignedJwtToken();

    return sendSuccess(res, 201, 'User registered successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        addresses: user.addresses
      },
      token
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, 'Please provide email and password');
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return sendError(res, 401, 'Invalid credentials');
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return sendError(res, 401, 'Invalid credentials');
    }

    const token = user.getSignedJwtToken();

    return sendSuccess(res, 200, 'Login successful', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        addresses: user.addresses,
        orderCount: user.orderCount,
        totalSpent: user.totalSpent,
        earnedCoupons: user.earnedCoupons
      },
      token
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    return sendSuccess(res, 200, 'User profile retrieved', { user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (phone !== undefined) fieldsToUpdate.phone = phone;
    if (avatar) fieldsToUpdate.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    return sendSuccess(res, 200, 'Profile updated successfully', { user });
  } catch (error) {
    next(error);
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 400, 'Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    const token = user.getSignedJwtToken();
    return sendSuccess(res, 200, 'Password changed successfully', { token });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - Request token
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return sendError(res, 404, 'There is no user with that email');
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, 200, 'Password reset token generated', {
      resetToken,
      message: 'Token generated for demo testing'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return sendError(res, 400, 'Invalid or expired password reset token');
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = user.getSignedJwtToken();
    return sendSuccess(res, 200, 'Password reset successful', { token });
  } catch (error) {
    next(error);
  }
};

// @desc    Add shipping address
// @route   POST /api/auth/address
// @access  Private
exports.addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const { fullName, phone, street, city, state, pincode, country, isDefault } = req.body;

    if (isDefault) {
      user.addresses.forEach(addr => (addr.isDefault = false));
    }

    const newAddress = {
      fullName,
      phone,
      street,
      city,
      state,
      pincode,
      country: country || 'India',
      isDefault: isDefault || user.addresses.length === 0
    };

    user.addresses.push(newAddress);
    await user.save();

    return sendSuccess(res, 201, 'Address added successfully', { addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete shipping address
// @route   DELETE /api/auth/address/:addressId
// @access  Private
exports.deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.addressId);
    await user.save();

    return sendSuccess(res, 200, 'Address deleted successfully', { addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

// @desc    Record customer browsing history in MongoDB
// @route   POST /api/auth/browsing-history
// @access  Private
exports.recordBrowsingHistory = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!productId) return sendError(res, 400, 'Product ID required');

    const user = await User.findById(req.user.id);
    if (user) {
      const historyStr = (user.browsingHistory || []).map(id => id.toString());
      const updated = [productId, ...historyStr.filter(id => id !== productId)].slice(0, 20);
      user.browsingHistory = updated;
      await user.save();
    }
    return sendSuccess(res, 200, 'Browsing history updated', { browsingHistory: user?.browsingHistory || [] });
  } catch (error) {
    next(error);
  }
};
