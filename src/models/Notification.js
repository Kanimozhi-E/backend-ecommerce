const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['order', 'system', 'promo'],
      default: 'order'
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    read: {
      type: Boolean,
      default: function() { return this.isRead; }
    },
    link: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

notificationSchema.pre('save', function (next) {
  this.read = this.isRead;
  next();
});

notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
