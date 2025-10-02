export const CONFIG = {
    // Google OAuth Configuration
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,

    // API Configuration (for future backend integration)
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',

    // Session Configuration
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours

    // Camera settings
    CAMERA: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'
    },

    // Zoom settings
    ZOOM: {
        min: 0.5,
        max: 3,
        step: 0.1
    },

    // Grid settings
    GRID: {
        size: 5,
        centerIndex: 12 // 0-based index for center cell (2,2 in 5x5 grid)
    },

    // Animation durations
    ANIMATION: {
        fast: 200,
        medium: 300,
        slow: 500
    },

    // Challenge file
    CHALLENGE_FILE: '2oct2025str.csv'
}; 