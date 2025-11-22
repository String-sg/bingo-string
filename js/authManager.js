import { CONFIG, getConfig } from './config.js';

export class AuthManager {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.googleAuth = null;
        this.clientId = null;

        this.init();
    }

    async init() {
        try {
            // Load configuration first
            console.log('🔧 AuthManager: Loading configuration...');
            const config = await getConfig();
            this.clientId = config.GOOGLE_CLIENT_ID;
            console.log('🔧 AuthManager: Client ID loaded:', this.clientId);

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
        console.log('🔧 Initializing Google Auth with Client ID:', this.clientId);

        if (!this.clientId || this.clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            console.error('❌ Google Client ID not configured. Current value:', this.clientId);
            console.error('❌ CONFIG object:', CONFIG);
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
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
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
            console.log('🔧 AuthManager: Loading stored session...');
            const stored = localStorage.getItem('bingoAuth');
            if (stored) {
                const session = JSON.parse(stored);
                console.log('🔧 AuthManager: Found stored session', session);

                // Check if session is still valid
                if (Date.now() - session.timestamp < CONFIG.SESSION_TIMEOUT) {
                    this.user = session.user;
                    this.isAuthenticated = true;
                    console.log('🔧 AuthManager: Session restored, user:', this.user.email);
                    this.updateUI();
                } else {
                    console.log('🔧 AuthManager: Session expired');
                    // Session expired
                    this.logout();
                }
            } else {
                console.log('🔧 AuthManager: No stored session found');
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

    async redirectToAdmin() {
        // Call backend to ensure user is created/updated
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const userData = await response.json();
                console.log('User synced with backend:', userData);
            } else {
                console.warn('Failed to sync user with backend');
            }
        } catch (error) {
            console.warn('Error syncing with backend:', error);
        }

        // Show admin dashboard
        this.showAdminDashboard();
    }

    showAdminDashboard() {
        // Hide main game interface
        const gridContainer = document.querySelector('.grid-container');
        const footer = document.querySelector('.footer');

        if (gridContainer) gridContainer.style.display = 'none';
        if (footer) footer.style.display = 'none';

        // Show admin dashboard
        const adminDashboard = document.getElementById('adminDashboard');
        if (adminDashboard) {
            adminDashboard.style.display = 'block';
            this.fetchUserGames();
        }
    }

    async fetchUserGames() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/games`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const games = await response.json();
                this.renderGamesList(games);
            }
        } catch (error) {
            console.error('Failed to fetch games:', error);
        }
    }

    renderGamesList(games) {
        const gamesList = document.getElementById('gamesList');
        const emptyState = document.getElementById('emptyState');

        if (!gamesList || !emptyState) return;

        if (games.length === 0) {
            gamesList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        gamesList.style.display = 'grid';
        gamesList.innerHTML = '';

        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';

            const date = new Date(game.updatedAt).toLocaleDateString();
            const shareUrl = `${window.location.origin}/play/${game.id}`;

            card.innerHTML = `
                <h3>${game.name}</h3>
                <p class="game-meta">Updated: ${date}</p>
                <div class="game-actions">
                    <a href="${shareUrl}" class="btn btn-sm btn-primary">Play</a>
                    <button type="button" class="btn btn-sm btn-outline" onclick="event.preventDefault(); navigator.clipboard.writeText('${shareUrl}').then(() => alert('Link copied!'))">Share</button>
                    <button type="button" class="btn btn-sm btn-outline" onclick="event.preventDefault(); window.bingoApp.authManager.showGameResults('${game.id}', '${game.name}')">Results</button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="event.preventDefault(); window.bingoApp.authManager.deleteGame('${game.id}')">Delete</button>
                </div>
            `;
            gamesList.appendChild(card);
        });
    }

    async showGameResults(gameId, gameName) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/games/${gameId}/results`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const sessions = await response.json();
                this.renderResultsModal(gameName, sessions);
            } else {
                alert('Failed to fetch results');
            }
        } catch (error) {
            console.error('Error fetching results:', error);
            alert('Error fetching results');
        }
    }

    renderResultsModal(gameName, sessions) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.zIndex = '2000';

        let content = `
            <div class="modal-content" style="max-width: 600px;">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>Results: ${gameName}</h2>
                <div class="results-list" style="max-height: 400px; overflow-y: auto; margin-top: 20px;">
        `;

        if (sessions.length === 0) {
            content += '<p>No players yet.</p>';
        } else {
            content += `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #eee; text-align: left;">
                            <th style="padding: 10px;">Player</th>
                            <th style="padding: 10px;">Status</th>
                            <th style="padding: 10px;">Completed At</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            sessions.forEach(session => {
                const completed = session.isCompleted ? '✅ Completed' : 'Playing';
                const time = session.completedAt ? new Date(session.completedAt).toLocaleString() : '-';
                content += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">${session.playerName || 'Anonymous'}</td>
                        <td style="padding: 10px;">${completed}</td>
                        <td style="padding: 10px;">${time}</td>
                    </tr>
                `;
            });

            content += `
                    </tbody>
                </table>
            `;
        }

        content += `
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                </div>
            </div>
        `;

        modal.innerHTML = content;
        document.body.appendChild(modal);
    }

    async deleteGame(gameId) {
        if (!confirm('Are you sure you want to delete this game?')) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/games/${gameId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                this.fetchUserGames();
            } else {
                alert('Failed to delete game');
            }
        } catch (error) {
            console.error('Error deleting game:', error);
            alert('Error deleting game');
        }
    }

    hideAdminDashboard() {
        // Show main game interface
        const gridContainer = document.querySelector('.grid-container');
        const footer = document.querySelector('.footer');

        if (gridContainer) gridContainer.style.display = 'block';
        if (footer) footer.style.display = 'block';

        // Hide admin dashboard
        const adminDashboard = document.getElementById('adminDashboard');
        if (adminDashboard) {
            adminDashboard.style.display = 'none';
        }
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