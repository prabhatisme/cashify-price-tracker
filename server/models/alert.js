const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true,
        index: true
    },
    targetPrice: {
        type: Number,
        required: true
    },
    currentPrice: {
        
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastChecked: {
        type: Date,
        default: Date.now
    },
    notificationsSent: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema); 