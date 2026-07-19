const CACHE_NAME = 'omnischool-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/admin.html',
    '/admin.js',
    '/bursar.html',
    '/bursar.js',
    '/dashboard.html',
    '/dashboard.js',
    '/grading.html', 
    '/grading.js',
    '/roster.html',  // NEW
    '/roster.js'     // NEW
];

// Install event: Cache the core files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Vault loaded with core assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch event: Serve from network first, fallback to cache if offline
self.addEventListener('fetch', event => {
    // Only intercept requests for our own files, let Firebase handle its own API calls
    if (event.request.url.includes('firestore')) return;

    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});