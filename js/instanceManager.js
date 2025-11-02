/**
 * Instance Manager - Handles multi-tenant instance configuration
 * Supports URL parameter-based instance loading: ?instance=abc123
 */
export class InstanceManager {
    constructor() {
        this.currentInstance = null;
        this.instanceConfig = null;
        this.defaultConfig = {
            id: 'default',
            title: 'String Bingo',
            description: 'Complete String challenges and get BINGO!',
            challengeFile: '2025_910samsung_bingo_challenges.csv',
            creator: 'String Team',
            created: new Date().toISOString(),
            theme: 'default',
            gridSize: 5,
            branding: {
                footer: 'Made with ❤️ by <a href="https://for.edu.sg/str-bingo-tree" target="_blank">String Team</a>',
                subtitle: 'For Samsung GenAI for Educators Community Event 2025 9.10'
            }
        };
    }

    /**
     * Get instance ID from URL parameters
     */
    getInstanceFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('instance');
    }

    /**
     * Load instance configuration
     */
    async loadInstance() {
        const instanceId = this.getInstanceFromURL();

        if (!instanceId) {
            console.log('🏠 No instance specified, using default configuration');
            this.currentInstance = 'default';
            this.instanceConfig = { ...this.defaultConfig };
            return this.instanceConfig;
        }

        try {
            console.log(`🔧 Loading instance: ${instanceId}`);

            // Try to load instance-specific config
            const configResponse = await fetch(`./configs/${instanceId}.json`);

            if (!configResponse.ok) {
                console.warn(`⚠️ Instance config not found for '${instanceId}', using default`);
                this.currentInstance = 'default';
                this.instanceConfig = { ...this.defaultConfig };
                return this.instanceConfig;
            }

            const instanceConfig = await configResponse.json();

            // Merge with defaults to ensure all required fields exist
            this.instanceConfig = {
                ...this.defaultConfig,
                ...instanceConfig,
                id: instanceId
            };

            this.currentInstance = instanceId;
            console.log(`✅ Loaded instance '${instanceId}':`, this.instanceConfig);

            return this.instanceConfig;

        } catch (error) {
            console.error(`❌ Failed to load instance '${instanceId}':`, error);
            console.log('🏠 Falling back to default configuration');

            this.currentInstance = 'default';
            this.instanceConfig = { ...this.defaultConfig };
            return this.instanceConfig;
        }
    }

    /**
     * Get current instance ID
     */
    getCurrentInstance() {
        return this.currentInstance;
    }

    /**
     * Get current instance configuration
     */
    getInstanceConfig() {
        return this.instanceConfig;
    }

    /**
     * Get challenge file path for current instance
     */
    getChallengeFile() {
        return this.instanceConfig?.challengeFile || this.defaultConfig.challengeFile;
    }

    /**
     * Apply instance branding to the page
     */
    applyBranding() {
        if (!this.instanceConfig) return;

        const config = this.instanceConfig;

        // Update page title
        if (config.title) {
            document.title = config.title;
        }

        // Update meta description
        if (config.description) {
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.content = config.description;
            }
        }

        // Update footer branding if provided
        if (config.branding?.footer) {
            const footerP = document.querySelector('.footer p:first-of-type');
            if (footerP) {
                footerP.innerHTML = config.branding.footer;
            }
        }

        // Update subtitle if provided
        if (config.branding?.subtitle) {
            const subtitleP = document.querySelector('.footer p:last-of-type');
            if (subtitleP) {
                subtitleP.textContent = config.branding.subtitle;
            }
        }

        // Add instance info to page for debugging
        if (this.currentInstance !== 'default') {
            console.log(`🎯 Instance '${this.currentInstance}' branding applied`);

            // Add a subtle indicator in the footer
            const footer = document.querySelector('.footer');
            if (footer && !footer.querySelector('.instance-indicator')) {
                const indicator = document.createElement('p');
                indicator.className = 'instance-indicator';
                indicator.style.cssText = 'font-size: 0.6em; color: #999; margin-top: 5px;';
                indicator.textContent = `Instance: ${this.currentInstance}`;
                footer.appendChild(indicator);
            }
        }
    }

    /**
     * Generate shareable URL for current instance
     */
    getShareableURL() {
        if (this.currentInstance === 'default') {
            return window.location.origin + window.location.pathname;
        }

        return `${window.location.origin}${window.location.pathname}?instance=${this.currentInstance}`;
    }

    /**
     * Validate instance ID format
     */
    static isValidInstanceId(instanceId) {
        // Allow alphanumeric, hyphens, and underscores, 3-50 characters
        return /^[a-zA-Z0-9_-]{3,50}$/.test(instanceId);
    }

    /**
     * Generate a new instance ID from title
     */
    static generateInstanceId(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .substring(0, 50) // Limit length
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }
}