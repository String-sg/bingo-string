export const CONFIG = {
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
    CHALLENGE_FILE: '2025_910samsung_bingo_challenges.csv'
}; 