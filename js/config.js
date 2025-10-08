// Runtime configuration system
class ConfigManager {
    constructor() {
        this.config = this.getDefaultConfig();
        this.loaded = false;
    }

    getDefaultConfig() {
        return {
            // Default/fallback configuration
            GOOGLE_CLIENT_ID: undefined,
            API_BASE_URL: 'http://localhost:3000/api',
            ENVIRONMENT: 'development',
            DEBUG_MODE: true,
            LOG_LEVEL: 'debug'
        };
    }

    detectEnvironment() {
        if (typeof window === 'undefined') return 'development';

        const hostname = window.location.hostname;
        if (hostname.includes('staging')) return 'staging';
        if (hostname === 'bingo.string.sg') return 'production';
        return 'development';
    }

    async loadConfig() {
        if (this.loaded) return this.config;

        try {
            const environment = this.detectEnvironment();

            // In development, use build-time env vars as fallback
            if (environment === 'development') {
                const getEnvVar = (key, defaultValue = undefined) => {
                    if (typeof import.meta !== 'undefined' && import.meta.env) {
                        return import.meta.env[key] || defaultValue;
                    }
                    return defaultValue;
                };

                this.config = {
                    ...this.config,
                    GOOGLE_CLIENT_ID: getEnvVar('VITE_GOOGLE_CLIENT_ID'),
                    API_BASE_URL: getEnvVar('VITE_API_BASE_URL', 'http://localhost:3000/api'),
                    ENVIRONMENT: 'development'
                };
                this.loaded = true;
                return this.config;
            }

            // For staging/production, fetch runtime config
            const configResponse = await fetch(`/config-${environment}.json`);
            if (!configResponse.ok) {
                throw new Error(`Failed to load config for ${environment}`);
            }

            const runtimeConfig = await configResponse.json();

            // Map runtime config to our internal format
            this.config = {
                ...this.config,
                GOOGLE_CLIENT_ID: runtimeConfig.googleClientId,
                API_BASE_URL: runtimeConfig.apiBaseUrl,
                ENVIRONMENT: runtimeConfig.environment,
                DEBUG_MODE: runtimeConfig.debugMode,
                LOG_LEVEL: runtimeConfig.logLevel
            };

            this.loaded = true;
            console.log(`✅ Loaded ${environment} configuration`);

        } catch (error) {
            console.warn('⚠️ Failed to load runtime config, using defaults:', error);
        }

        return this.config;
    }

    get(key) {
        return this.config[key];
    }
}

// Create global config manager
const configManager = new ConfigManager();

// Export async function to get config
export const getConfig = () => configManager.loadConfig();

// Export legacy CONFIG object for backward compatibility
export const CONFIG = {
    // Legacy getters that will be populated after config loads
    get GOOGLE_CLIENT_ID() { return configManager.get('GOOGLE_CLIENT_ID'); },
    get API_BASE_URL() { return configManager.get('API_BASE_URL'); },

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
    CHALLENGE_FILE: '2025_910samsung_bingo_challenges.csv'
}; 