// Server endpoint
const API_ENDPOINT = 'http://localhost:3000/api/prices';

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background script received message:', message);

    if (message.type === 'PRICE_UPDATED') {
        handlePriceUpdate(message.data);
    }
});

// Function to handle price updates
async function handlePriceUpdate(data) {
    try {
        console.log('Sending price update to server:', data);
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save price update');
        }

        const result = await response.json();
        console.log('Price update saved successfully:', result);
    } catch (error) {
        console.error('Error saving price update:', error);
    }
}

// Create alarm for periodic price checks
chrome.alarms.create('checkPrices', {
    periodInMinutes: 360 // Check every 6 hours (6 * 60 minutes)
});

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkPrices') {
        try {
            console.log('Running scheduled price check...');
            const response = await fetch('http://localhost:3000/api/alerts');
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const alerts = await response.json();
            console.log(`Found ${alerts.length} active alerts`);
            
            // Update prices for all alerts
            for (const alert of alerts) {
                try {
                    const tabs = await chrome.tabs.query({});
                    const alertTab = tabs.find(tab => tab.url === alert.url);
                    
                    if (alertTab) {
                        // If tab is open, use content script
                        await chrome.tabs.sendMessage(alertTab.id, { type: 'CHECK_PRICE' });
                    } else {
                        // If tab is not open, let server handle it
                        console.log(`Tab not open for ${alert.url}, server will handle price check`);
                    }
                } catch (error) {
                    console.error(`Error checking price for ${alert.url}:`, error);
                }
            }
        } catch (error) {
            console.error('Error during scheduled price check:', error);
        }
    }
});

// Function to check prices for all tabs
async function checkPricesForAllTabs() {
    try {
        const tabs = await chrome.tabs.query({
            url: '*://*.cashify.in/*'
        });

        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PRICE' });
                console.log('Price check initiated for tab:', tab.url);
            } catch (error) {
                console.error('Error checking price for tab:', tab.url, error);
            }
        }
    } catch (error) {
        console.error('Error querying tabs:', error);
    }
} 