import { CONFIG } from './config.js';

export class AuthManager {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.googleAuth = null;
        this.clientId = CONFIG.GOOGLE_CLIENT_ID;

        this.init();
    }

    async init() {
        try {
            // Wait for Google Identity Services to load
            await this.waitForGoogleAuth();

            // Initialize Google Auth
            await this.initializeGoogleAuth();

            // Check for existing session
            this.loadStoredSession();

        } catch (error) {
            console.error('Failed to initialize auth:', error);
        }
    }

    waitForGoogleAuth() {
        return new Promise((resolve, reject) => {
            if (window.google?.accounts?.id) {
                resolve();
                return;
            }

            let attempts = 0;
            const maxAttempts = 50;
            const checkGoogle = () => {
                attempts++;
                if (window.google?.accounts?.id) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Google Identity Services failed to load'));
                } else {
                    setTimeout(checkGoogle, 100);
                }
            };
            checkGoogle();
        });
    }

    async initializeGoogleAuth() {
        if (!this.clientId || this.clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            console.warn('Google Client ID not configured. Please update CONFIG.GOOGLE_CLIENT_ID in config.js');
            return;
        }

        window.google.accounts.id.initialize({
            client_id: this.clientId,
            callback: this.handleGoogleResponse.bind(this),
            auto_select: false,
            cancel_on_tap_outside: true
        });

        // Render the sign-in button
        this.renderSignInButton();
    }

    renderSignInButton() {
        const signInBtn = document.getElementById('googleSignInBtn');
        if (signInBtn) {
            window.google.accounts.id.renderButton(signInBtn, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                width: 300
            });
        }
    }

    handleGoogleResponse(response) {
        try {
            // Decode the JWT token
            const userInfo = this.parseJWT(response.credential);

            this.user = {
                id: userInfo.sub,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                token: response.credential
            };

            this.isAuthenticated = true;
            this.storeSession();
            this.updateUI();

            // Close auth modal and redirect to admin
            this.closeAuthModal();
            this.redirectToAdmin();

            // Track successful login
            if (typeof gtag !== 'undefined') {
                gtag('event', 'login', {
                    'event_category': 'engagement',
                    'event_label': 'google_oauth',
                    'value': 1
                });
            }

        } catch (error) {
            console.error('Failed to handle Google response:', error);
            this.showError('Login failed. Please try again.');
        }
    }

    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            throw new Error('Invalid token format');
        }
    }

    storeSession() {
        if (this.user) {
            localStorage.setItem('bingoAuth', JSON.stringify({
                user: this.user,
                timestamp: Date.now()
            }));
        }
    }

    loadStoredSession() {
        try {
            const stored = localStorage.getItem('bingoAuth');
            if (stored) {
                const session = JSON.parse(stored);

                // Check if session is still valid
                if (Date.now() - session.timestamp < CONFIG.SESSION_TIMEOUT) {
                    this.user = session.user;
                    this.isAuthenticated = true;
                    this.updateUI();
                } else {
                    // Session expired
                    this.logout();
                }
            }
        } catch (error) {
            console.error('Failed to load stored session:', error);
            this.logout();
        }
    }

    logout() {
        this.user = null;
        this.isAuthenticated = false;
        localStorage.removeItem('bingoAuth');
        this.updateUI();

        // Track logout
        if (typeof gtag !== 'undefined') {
            gtag('event', 'logout', {
                'event_category': 'engagement',
                'event_label': 'manual',
                'value': 1
            });
        }
    }

    updateUI() {
        const authBtn = document.getElementById('authBtn');
        const makeYourOwnBtn = document.getElementById('makeYourOwnBtn');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');

        if (this.isAuthenticated && this.user) {
            // Show authenticated state
            if (authBtn) authBtn.style.display = 'none';
            if (makeYourOwnBtn) makeYourOwnBtn.style.display = 'inline-block';
            if (userInfo) userInfo.style.display = 'block';
            if (userName) userName.textContent = this.user.name;
            if (userAvatar) userAvatar.src = this.user.picture;
        } else {
            // Show unauthenticated state
            if (authBtn) authBtn.style.display = 'inline-block';
            if (makeYourOwnBtn) makeYourOwnBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';
        }
    }

    showAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    redirectToAdmin() {
        // For now, just show an alert. In PR 2, this will redirect to admin dashboard
        alert(`Welcome ${this.user.name}! Admin dashboard coming in PR 2.`);
    }

    showError(message) {
        const status = document.getElementById('status');
        if (status) {
            status.textContent = message;
            status.className = 'status error';
            status.style.display = 'block';

            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }

    // Public methods for app integration
    getUser() {
        return this.user;
    }

    isLoggedIn() {
        return this.isAuthenticated;
    }

    getAuthHeaders() {
        if (this.isAuthenticated && this.user?.token) {
            return {
                'Authorization': `Bearer ${this.user.token}`
            };
        }
        return {};
    }
}