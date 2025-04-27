require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Price = require('./models/price');
const Alert = require('./models/alert');
const { sendPriceAlert, sendTestAlert } = require('./utils/telegram');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/price-tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    setupDataCleanup();
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

// Function to clean up old data
async function cleanupOldData() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    try {
        // Clean up old price records
        const priceResult = await Price.deleteMany({ 
            timestamp: { $lt: oneYearAgo }
        });
        console.log(`Cleaned up ${priceResult.deletedCount} old price records`);

        // Clean up inactive alerts older than a year
        const alertResult = await Alert.deleteMany({ 
            isActive: false,
            updatedAt: { $lt: oneYearAgo }
        });
        console.log(`Cleaned up ${alertResult.deletedCount} old inactive alerts`);
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Setup periodic cleanup
function setupDataCleanup() {
    setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
    cleanupOldData();
}

// Function to extract price from a Cashify product page
async function extractPriceFromUrl(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const priceElement = $('span[itemprop="price"]');
        if (priceElement.length) {
            const price = parseFloat(priceElement.text().replace(/[^0-9.]/g, ''));
            return price;
        }
        return null;
    } catch (error) {
        console.error(`Error extracting price from ${url}:`, error);
        return null;
    }
}

// Function to check prices for all active alerts
async function checkAllPrices() {
    try {
        console.log('Starting price check for all active alerts...');
        const alerts = await Alert.find({ isActive: true });
        
        for (const alert of alerts) {
            try {
                const currentPrice = await extractPriceFromUrl(alert.url);
                
                if (currentPrice !== null) {
                    // Update the alert with new price
                    alert.currentPrice = currentPrice;
                    alert.lastChecked = new Date();
                    await alert.save();

                    // Check if target price is met
                    if (currentPrice <= alert.targetPrice) {
                        await sendPriceAlert(
                            alert.productName,
                            currentPrice,
                            alert.targetPrice,
                            alert.url
                        );
                    }
                }
            } catch (error) {
                console.error(`Error checking price for alert ${alert._id}:`, error);
            }
        }
        console.log('Completed price check for all active alerts');
    } catch (error) {
        console.error('Error in checkAllPrices:', error);
    }
}

// Schedule price checks every 6 hours
setInterval(checkAllPrices, 6 * 60 * 60 * 1000);

// Run initial price check when server starts
checkAllPrices();

// Routes for price tracking
app.post('/api/prices', async (req, res) => {
    try {
        const { price, productName, url, timestamp } = req.body;
        
        // Save price history
        const priceRecord = new Price({
            price,
            productName,
            url,
            timestamp
        });
        await priceRecord.save();

        // Check alerts and send notifications
        if (price) {
            const alerts = await Alert.find({ url, isActive: true });
            for (const alert of alerts) {
                if (price <= alert.targetPrice) {
                    // Send Telegram notification
                    await sendPriceAlert(
                        alert.productName,
                        price,
                        alert.targetPrice,
                        url
                    );
                }
            }

            // Update current price in active alerts
            await Alert.updateMany(
                { url, isActive: true },
                { 
                    currentPrice: price,
                    lastChecked: new Date()
                }
            );
        }

        res.status(201).json(priceRecord);
    } catch (error) {
        console.error('Error saving price:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get price history
app.get('/api/prices', async (req, res) => {
    try {
        const { url } = req.query;
        const prices = await Price.find({ url })
            .sort({ timestamp: -1 })
            .limit(100);
        res.json(prices);
    } catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({ error: error.message });
    }
});

// Routes for alerts
app.post('/api/alerts', async (req, res) => {
    try {
        const { url, targetPrice, productName, currentPrice, remove } = req.body;
        console.log('Received alert request:', {
            url,
            targetPrice,
            productName,
            currentPrice,
            remove
        });
        
        if (remove) {
            const result = await Alert.findOneAndUpdate(
                { url, isActive: true },
                { isActive: false },
                { new: true }
            );
            console.log('Alert deactivated:', result);
            res.json({ message: 'Alert deactivated successfully', alert: result });
        } else {
            // Update existing alert or create new one
            console.log('Creating/updating alert with data:', {
                url,
                targetPrice,
                productName,
                currentPrice
            });
            
            const alert = await Alert.findOneAndUpdate(
                { url, isActive: true },
                {
                    targetPrice,
                    productName,
                    currentPrice,
                    lastChecked: new Date(),
                    isActive: true
                },
                { upsert: true, new: true }
            );
            console.log('Alert saved successfully:', alert);
            res.json(alert);
        }
    } catch (error) {
        console.error('Error managing alert:', error);
        console.error('Full error details:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: error.message });
    }
});

// Get all active alerts
app.get('/api/alerts', async (req, res) => {
    try {
        const alerts = await Alert.find({ isActive: true })
            .sort({ updatedAt: -1 });
        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get alerts for specific URL
app.get('/api/alerts/url', async (req, res) => {
    try {
        const { url } = req.query;
        const alert = await Alert.findOne({ url, isActive: true });
        res.json(alert || null);
    } catch (error) {
        console.error('Error fetching alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual cleanup endpoint
app.post('/api/cleanup', async (req, res) => {
    try {
        await cleanupOldData();
        res.json({ message: 'Cleanup completed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a test notification endpoint
app.post('/api/test-notification', async (req, res) => {
    try {
        const { productName, currentPrice, url } = req.body;
        await sendTestAlert(productName, currentPrice, url);
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 