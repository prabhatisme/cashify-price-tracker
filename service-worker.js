// Cache configuration
const CACHE_NAME = 'cashify-price-tracker-v1';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const API_BASE_URL = 'https://cashify-price-tracker.onrender.com/api';

// Cache management
async function getCachedData(key) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(key);
        if (response) {
            const data = await response.json();
            if (Date.now() - data.timestamp < CACHE_DURATION) {
                return data.value;
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
        const cache = await caches.open(CACHE_NAME);
        const data = {
            value,
            timestamp: Date.now()
        };
        await cache.put(key, new Response(JSON.stringify(data)));
    } catch (error) {
        console.error('Error setting cached data:', error);
    }
}

// Background data fetching
async function fetchAndCacheData(url, cacheKey) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}`);
        }
        const data = await response.json();
        await setCachedData(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Error fetching and caching data:', error);
        return null;
    }
}

// Periodic background sync
async function syncData() {
    try {
        // Fetch all alerts
        const alerts = await fetchAndCacheData(
            `${API_BASE_URL}/alerts`,
            'allAlerts'
        );

        // Fetch price history for each alert
        if (alerts && alerts.length > 0) {
            for (const alert of alerts) {
                await fetchAndCacheData(
                    `${API_BASE_URL}/prices?url=${encodeURIComponent(alert.url)}`,
                    `priceHistory_${alert.url}`
                );
            }
        }
    } catch (error) {
        console.error('Error in background sync:', error);
    }
}

// Service Worker event listeners
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/popup.html',
                '/popup.js',
                '/content.js'
            ]);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'SYNC_DATA') {
        event.waitUntil(syncData());
    }
});

// Handle fetch events
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Only handle API requests
    if (url.origin === API_BASE_URL) {
        event.respondWith(
            (async () => {
                // Try to get from cache first
                const cachedData = await getCachedData(event.request.url);
                if (cachedData) {
                    return new Response(JSON.stringify(cachedData));
                }

                // If not in cache, fetch from network
                try {
                    const response = await fetch(event.request);
                    const data = await response.json();
                    await setCachedData(event.request.url, data);
                    return new Response(JSON.stringify(data));
                } catch (error) {
                    console.error('Error fetching data:', error);
                    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
                        status: 500
                    });
                }
            })()
        );
    }
});

// Set up periodic background sync
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
}); 