document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const checkNowButton = document.getElementById('checkNow');
    const priceHistoryDiv = document.getElementById('priceHistory');
    const alertPriceInput = document.getElementById('alertPrice');
    const setAlertButton = document.getElementById('setAlert');
    const currentAlertDiv = document.getElementById('currentAlert');
    const allAlertsDiv = document.getElementById('allAlerts');
    const testAlertButton = document.getElementById('testAlert');

    // Add loading states
    function setLoading(element, isLoading) {
        if (isLoading) {
            element.innerHTML = '<div class="loading">Loading...</div>';
        }
    }

    // Tab handling
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update button states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update content visibility
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}Tab`).classList.add('active');

            // Load alerts if switching to alerts tab
            if (tabName === 'alerts') {
                setLoading(allAlertsDiv, true);
                loadAllAlerts();
            }
        });
    });

    // Check if we're on a valid Cashify page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isCashifyPage = tab.url.includes('cashify.in');

    if (isCashifyPage) {
        statusDiv.textContent = 'Active on this page';
        statusDiv.className = 'status active';
        
        // Load data in parallel
        setLoading(priceHistoryDiv, true);
        setLoading(currentAlertDiv, true);
        
        Promise.all([
            fetchPriceHistory(tab.url),
            loadAlertPrice(tab.url)
        ]).catch(error => {
            console.error('Error loading initial data:', error);
        });
    } else {
        statusDiv.textContent = 'Not a Cashify page';
        statusDiv.className = 'status inactive';
        priceHistoryDiv.innerHTML = '<p>Visit a Cashify product page to see price history.</p>';
    }

    // Handle manual price check
    checkNowButton.addEventListener('click', async () => {
        if (isCashifyPage) {
            try {
                statusDiv.textContent = 'Checking price...';
                
                // Ensure content script is injected
                await ensureContentScriptInjected(tab.id);
                
                // Send message to content script
                await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PRICE' });
                
                // Wait a moment for the price to be processed
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Refresh price history
                await fetchPriceHistory(tab.url);
                
                statusDiv.textContent = 'Price check completed';
                statusDiv.className = 'status active';
            } catch (error) {
                console.error('Error checking price:', error);
                statusDiv.textContent = 'Failed to check price';
                statusDiv.className = 'status inactive';
            }
        }
    });

    // Handle setting price alert
    setAlertButton.addEventListener('click', async () => {
        if (isCashifyPage) {
            statusDiv.textContent = 'Setting price alert...';
            const alertPrice = parseFloat(alertPriceInput.value);
            if (!isNaN(alertPrice) && alertPrice > 0) {
                try {
                    await saveAlertPrice(tab.url, alertPrice);
                    updateCurrentAlert(alertPrice);
                    statusDiv.textContent = 'Price alert set successfully';
                    statusDiv.className = 'status active';
                    // Refresh alerts list if on alerts tab
                    if (document.getElementById('alertsTab').classList.contains('active')) {
                        loadAllAlerts();
                    }
                } catch (error) {
                    console.error('Failed to set alert:', error);
                    statusDiv.textContent = `Failed to set price alert: ${error.message}`;
                    statusDiv.className = 'status inactive';
                }
            } else {
                statusDiv.textContent = 'Please enter a valid price';
                statusDiv.className = 'status inactive';
            }
        }
    });

    // Handle test alert button
    testAlertButton.addEventListener('click', async () => {
        if (isCashifyPage) {
            try {
                statusDiv.textContent = 'Sending test alert...';
                
                // Ensure content script is injected
                await ensureContentScriptInjected(tab.id);
                
                // Send test alert message and wait for response
                const response = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tab.id, { type: 'TEST_ALERT' }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else if (response && response.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                console.log('Test alert response:', response);
                statusDiv.textContent = 'Test alert sent successfully';
                statusDiv.className = 'status active';
            } catch (error) {
                console.error('Error sending test alert:', error);
                statusDiv.textContent = `Failed to send test alert: ${error.message}`;
                statusDiv.className = 'status inactive';
            }
        }
    });
});

// Function to ensure content script is injected
async function ensureContentScriptInjected(tabId) {
    try {
        // Try to send a test message first
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    } catch (error) {
        // If content script is not available, inject it
        console.log('Injecting content script...');
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Add cache management functions
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

async function getCachedData(key) {
    try {
        const data = await chrome.storage.local.get(key);
        if (data[key]) {
            const { value, timestamp } = data[key];
            if (Date.now() - timestamp < CACHE_DURATION) {
                return value;
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting cached data:', error);
        return null;
    }
}

async function setCachedData(key, value) {
    try {
        await chrome.storage.local.set({
            [key]: {
                value,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('Error setting cached data:', error);
    }
}

// Register service worker and request periodic sync
async function registerServiceWorker() {
    try {
        const registration = await navigator.serviceWorker.register('service-worker.js');
        if ('periodicSync' in registration) {
            try {
                await registration.periodicSync.register('sync-data', {
                    minInterval: 5 * 60 * 1000 // 5 minutes
                });
            } catch (error) {
                console.error('Periodic sync registration failed:', error);
            }
        }
    } catch (error) {
        console.error('Service worker registration failed:', error);
    }
}

// Initialize service worker
registerServiceWorker();

// Update data fetching functions to use service worker
async function loadAllAlerts() {
    try {
        const response = await fetch('https://cashify-price-tracker.onrender.com/api/alerts');
        if (!response.ok) {
            throw new Error('Failed to fetch alerts');
        }
        const alerts = await response.json();
        displayAllAlerts(alerts);
    } catch (error) {
        console.error('Error loading alerts:', error);
        document.getElementById('allAlerts').innerHTML = 
            '<p>Error loading alerts. Please make sure the server is running.</p>';
    }
}

function displayAllAlerts(alerts) {
    const allAlertsDiv = document.getElementById('allAlerts');
    if (alerts.length === 0) {
        allAlertsDiv.innerHTML = '<p>No active price alerts.</p>';
        return;
    }

    const alertsHtml = alerts.map(alert => `
        <div class="alert-item">
            <div class="alert-details">
                <div><strong><a href="${alert.url}" target="_blank" rel="noopener noreferrer">${alert.productName}</a></strong></div>
                <div>Current: &#8377;${alert.currentPrice} | Target: &#8377;${alert.targetPrice}</div>
                <div class="timestamp">Set on: ${new Date(alert.createdAt).toLocaleString()}</div>
                <div class="timestamp">Last checked: ${new Date(alert.lastChecked).toLocaleString()}</div>
            </div>
            <div class="alert-actions">
                <button class="remove-alert" onclick="removeAlert('${alert.url}')">Remove</button>
            </div>
        </div>
    `).join('');

    allAlertsDiv.innerHTML = alertsHtml;
}

async function removeAlert(url) {
    try {
        // Show loading state
        const allAlertsDiv = document.getElementById('allAlerts');
        allAlertsDiv.innerHTML = '<div class="loading">Removing alert...</div>';

        // Send remove request to server
        const response = await fetch('https://cashify-price-tracker.onrender.com/api/alerts', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            throw new Error('Failed to remove alert');
        }

        // Clear local storage
        await chrome.storage.local.remove(url);

        // Clear service worker cache
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            const cache = await caches.open('cashify-price-tracker-v1');
            await cache.delete(`alertPrice_${url}`);
        }

        // Refresh alerts list
        await loadAllAlerts();

        // If we're on the current page tab and the URL matches, clear the current alert
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.url === url) {
            updateCurrentAlert(null);
            document.getElementById('alertPrice').value = '';
        }
    } catch (error) {
        console.error('Error removing alert:', error);
        document.getElementById('allAlerts').innerHTML = 
            '<p>Error removing alert. Please try again.</p>';
    }
}

// Make removeAlert function available globally
window.removeAlert = removeAlert;

async function loadAlertPrice(url) {
    try {
        const response = await fetch(`https://cashify-price-tracker.onrender.com/api/alerts/url?url=${encodeURIComponent(url)}`);
        if (response.ok) {
            const alert = await response.json();
            if (alert) {
                updateCurrentAlert(alert.targetPrice);
                return;
            }
        }

        // Fallback to chrome storage
        const data = await chrome.storage.local.get(url);
        if (data[url]) {
            const alertPrice = data[url].alertPrice;
            updateCurrentAlert(alertPrice);
        } else {
            updateCurrentAlert(null);
        }
    } catch (error) {
        console.error('Error loading alert price:', error);
        updateCurrentAlert(null);
    }
}

async function saveAlertPrice(url, alertPrice) {
    try {
        console.log('Starting to save alert price:', { url, alertPrice });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Got active tab:', tab.url);

        // Function to attempt getting data from content script
        const getDataFromContentScript = async (retryCount = 0) => {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for content script response'));
                }, 5000); // Increased timeout to 5 seconds

                chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_DATA' }, (response) => {
                    clearTimeout(timeout);
                    console.log('Content script response:', response);
                    
                    if (chrome.runtime.lastError) {
                        console.log('Error in sendMessage:', chrome.runtime.lastError);
                        if (retryCount < 2) {
                            console.log(`Retrying content script injection (attempt ${retryCount + 1})`);
                            // Inject content script and retry
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['content.js']
                            }).then(() => {
                                console.log('Content script injected successfully');
                                // Wait a bit for the script to initialize
                                setTimeout(() => {
                                    getDataFromContentScript(retryCount + 1)
                                        .then(resolve)
                                        .catch(reject);
                                }, 1000); // Increased wait time to 1 second
                            }).catch(error => {
                                console.error('Failed to inject content script:', error);
                                reject(error);
                            });
                        } else {
                            reject(new Error('Could not establish connection after retries'));
                        }
                    } else if (!response) {
                        console.error('No response from content script');
                        reject(new Error('No response from content script'));
                    } else {
                        console.log('Successfully received data from content script');
                        resolve(response);
                    }
                });
            });
        };

        // Try to get data with retries
        console.log('Attempting to get data from content script...');
        const response = await getDataFromContentScript();
        
        if (!response || !response.price) {
            console.error('Invalid response data:', response);
            throw new Error('Could not get current price data');
        }

        console.log('Successfully got price data:', response);

        // Save to chrome storage
        await chrome.storage.local.set({
            [url]: {
                alertPrice: alertPrice,
                timestamp: new Date().toISOString()
            }
        });
        console.log('Saved to chrome storage');

        // Prepare data for server
        const serverData = {
            url,
            targetPrice: alertPrice,
            productName: response.productName || 'Unknown Product',
            currentPrice: response.price
        };
        console.log('Sending data to server:', serverData);

        // Save to server
        const serverResponse = await fetch('https://cashify-price-tracker.onrender.com/api/alerts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(serverData)
        });

        const responseText = await serverResponse.text();
        console.log('Raw server response:', responseText);

        if (!serverResponse.ok) {
            console.error('Server response not OK:', {
                status: serverResponse.status,
                statusText: serverResponse.statusText,
                response: responseText
            });
            throw new Error(`Failed to save alert to server: ${serverResponse.status} ${responseText}`);
        }

        const serverDataResponse = responseText ? JSON.parse(responseText) : null;
        console.log('Alert saved successfully:', serverDataResponse);

    } catch (error) {
        console.error('Error in saveAlertPrice:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

function updateCurrentAlert(alertPrice) {
    const currentAlertDiv = document.getElementById('currentAlert');
    if (alertPrice) {
        currentAlertDiv.textContent = `Alert set for: `;
        currentAlertDiv.innerHTML = `Alert set for: &#8377;${alertPrice}`;
        document.getElementById('alertPrice').value = alertPrice;
    } else {
        currentAlertDiv.textContent = 'No price alert set';
    }
}

async function fetchPriceHistory(url) {
    try {
        const response = await fetch(`https://cashify-price-tracker.onrender.com/api/prices?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch price history');
        }
        const prices = await response.json();
        displayPriceHistory(prices);
    } catch (error) {
        console.error('Error fetching price history:', error);
        document.getElementById('priceHistory').innerHTML = 
            '<p>Error loading price history. Please make sure the server is running.</p>';
    }
}

function displayPriceHistory(prices) {
    const priceHistoryDiv = document.getElementById('priceHistory');
    if (prices.length === 0) {
        priceHistoryDiv.innerHTML = '<p>No price history available yet.</p>';
        return;
    }

    const priceRecords = prices.map(record => `
        <div class="price-record">
            <strong>&#8377;${record.price}</strong>
            <div class="timestamp">${new Date(record.timestamp).toLocaleString()}</div>
        </div>
    `).join('');

    priceHistoryDiv.innerHTML = priceRecords;
} 