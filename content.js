// Announce content script presence
console.log('Cashify Price Tracker content script loaded');

// Function to extract price from the page
function extractPrice() {
    const priceElement = document.querySelector('span[itemprop="price"]');
    if (priceElement) {
        const price = priceElement.textContent.replace('₹', '').replace(/,/g, '');
        return parseFloat(price);
    }
    return null;
}

// Function to extract product name
function extractProductName() {
    const titleElement = document.querySelector('h1');
    return titleElement ? titleElement.textContent.trim() : 'Unknown Product';
}

// Initialize message listener
try {
    // Listen for messages from popup/background
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Content script received message:', message);
            
            if (message.type === 'PING') {
                // Respond immediately to confirm content script is active
                sendResponse({ status: 'active' });
                return false; // No async response needed
            }
            
            if (message.type === 'GET_CURRENT_DATA') {
                console.log('Processing GET_CURRENT_DATA request');
                const price = extractPrice();
                const productName = extractProductName();
                
                console.log('Extracted data:', { price, productName });
                sendResponse({
                    price: price,
                    productName: productName
                });
                return false; // No async response needed
            }
            
            if (message.type === 'CHECK_PRICE') {
                console.log('Processing CHECK_PRICE request');
                sendPrice().then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    sendResponse({ error: error.message });
                });
                return true; // Will respond asynchronously
            }
            
            if (message.type === 'TEST_ALERT') {
                console.log('Processing TEST_ALERT request');
                // Handle test alert asynchronously
                testPriceAlert().then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error('Test alert error:', error);
                    sendResponse({ error: error.message });
                });
                return true; // Will respond asynchronously
            }
            
            return false; // No async response needed for unknown messages
        });
        console.log('Message listener initialized successfully');
    } else {
        console.error('Chrome runtime API not available');
    }
} catch (error) {
    console.error('Error initializing message listener:', error);
}

// Function to send price to background script
async function sendPrice() {
    try {
        const price = extractPrice();
        const productName = extractProductName();
        
        if (price) {
            const data = {
                type: 'PRICE_UPDATED',
                data: {
                    price: price,
                    productName: productName,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                }
            };
            console.log('Sending price update:', data);
            await chrome.runtime.sendMessage(data);
            console.log('Price update sent successfully');
        } else {
            console.log('No price found on page');
        }
    } catch (error) {
        console.error('Error sending price:', error);
    }
}

// Test function to simulate price drop and send Telegram notification
async function testPriceAlert() {
    try {
        const currentPrice = extractPrice();
        const productName = extractProductName();
        
        if (currentPrice && productName) {
            console.log('Sending test alert to Telegram...');
            const response = await fetch('http://localhost:3000/api/test-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productName,
                    currentPrice,
                    url: window.location.href
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to send test notification: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Test notification sent successfully:', result);
        } else {
            throw new Error('Could not extract price or product name from page');
        }
    } catch (error) {
        console.error('Error sending test alert:', error);
        throw error;
    }
}

// Initialize price tracking when DOM is ready
function initializePriceTracking() {
    try {
        console.log('Initializing price tracking');
        const priceElement = document.querySelector('span[itemprop="price"]');
        if (priceElement) {
            console.log('Found price element, setting up observer');
            // Initial price check
            sendPrice();
            
            // Set up observer
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'characterData' || mutation.type === 'childList') {
                        sendPrice();
                    }
                });
            });
            
            observer.observe(priceElement, {
                characterData: true,
                childList: true,
                subtree: true
            });
            
            // Cleanup on page unload
            window.addEventListener('unload', () => {
                observer.disconnect();
            });
        } else {
            console.log('Price element not found on page');
        }
    } catch (error) {
        console.error('Error initializing price tracking:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePriceTracking);
} else {
    initializePriceTracking();
} 