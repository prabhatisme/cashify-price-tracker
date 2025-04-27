const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
    price: {
        type: Number,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient queries
priceSchema.index({ url: 1, timestamp: -1 });

module.exports = mongoose.model('Price', priceSchema); 