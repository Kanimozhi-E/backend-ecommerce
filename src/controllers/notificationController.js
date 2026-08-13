const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/responseHandler');

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20);
    const unreadCount = await Notification.countDocuments({ user: req.user.id, isRead: false });

    return sendSuccess(res, 200, 'Notifications retrieved', { notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    return sendSuccess(res, 200, 'Notifications marked as read');
  } catch (error) {
    next(error);
  }
};
