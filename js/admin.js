import { CONFIG } from './config.js';
import { AuthManager } from './authManager.js';

class AdminDashboard {
    constructor() {
        this.authManager = new AuthManager();
        this.games = [];
        this.currentGameId = null;

        this.init();
    }

    async init() {
        // Wait for auth to initialize
        await this.waitForAuth();

        // Check if user is authenticated
        if (!this.authManager.isLoggedIn()) {
            // Redirect to main page if not authenticated
            window.location.href = '/index.html';
            return;
        }

        // Setup UI
        this.setupUI();
        this.setupEventListeners();
        this.setupChallengesGrid();

        // Load user's games
        await this.loadGames();
    }

    async waitForAuth() {
        // Wait up to 3 seconds for auth to initialize
        let attempts = 0;
        while (attempts < 30 && !this.authManager.clientId) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }

    setupUI() {
        const user = this.authManager.getUser();
        if (user) {
            const avatar = document.getElementById('adminUserAvatar');
            const name = document.getElementById('adminUserName');

            if (avatar) avatar.src = user.picture || '';
            if (name) name.textContent = user.name || user.email;
        }
    }

    setupEventListeners() {
        // Create game buttons
        document.getElementById('createGameBtn')?.addEventListener('click', () => this.showCreateGameModal());
        document.getElementById('createGameBtnEmpty')?.addEventListener('click', () => this.showCreateGameModal());

        // Modal close buttons
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // Create game form
        document.getElementById('createGameForm')?.addEventListener('submit', (e) => this.handleCreateGame(e));
        document.getElementById('cancelCreateBtn')?.addEventListener('click', () => this.hideCreateGameModal());

        // Generate sample challenges
        document.getElementById('generateSampleBtn')?.addEventListener('click', () => this.generateSampleChallenges());

        // Logout
        document.getElementById('adminLogoutBtn')?.addEventListener('click', () => this.logout());

        // Game actions
        document.getElementById('viewGameBtn')?.addEventListener('click', () => this.viewGame());
        document.getElementById('editGameBtn')?.addEventListener('click', () => this.editGame());
        document.getElementById('copyLinkBtn')?.addEventListener('click', () => this.copyGameLink());
        document.getElementById('deleteGameBtn')?.addEventListener('click', () => this.deleteGame());

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    setupChallengesGrid() {
        const grid = document.getElementById('challengesGrid');
        if (!grid) return;

        // Create 25 challenge inputs
        for (let i = 0; i < 25; i++) {
            const textarea = document.createElement('textarea');
            textarea.className = 'challenge-input';
            textarea.rows = 3;
            textarea.placeholder = i === 12 ? 'FREE' : `Challenge ${i + 1}`;
            textarea.required = i !== 12; // Center square is not required

            if (i === 12) {
                textarea.value = 'FREE';
                textarea.readOnly = true;
            }

            grid.appendChild(textarea);
        }
    }

    generateSampleChallenges() {
        const sampleChallenges = [
            "Find someone who has traveled to more than 5 countries",
            "Locate a person who can speak 3+ languages",
            "Find someone who has run a marathon",
            "Meet someone who has never broken a bone",
            "Find a person who is left-handed",
            "Locate someone who has met a celebrity",
            "Find someone who can play a musical instrument",
            "Meet a person who has been skydiving",
            "Find someone who has never been on a plane",
            "Locate a person who was born in another country",
            "Find someone who has more than 3 siblings",
            "Meet a person who has never had coffee",
            "FREE", // Center square
            "Find someone who can solve a Rubik's cube",
            "Locate a person who has been to all 7 continents",
            "Find someone who has never had a pet",
            "Meet a person who can whistle loudly",
            "Find someone who has gotten a tattoo",
            "Locate a person who has never seen snow",
            "Find someone who has been in a movie/TV show",
            "Meet a person who can juggle",
            "Find someone who has climbed a mountain",
            "Locate a person who has never been to a concert",
            "Find someone who can speak sign language",
            "Meet a person who has never used social media"
        ];

        const inputs = document.querySelectorAll('.challenge-input');
        inputs.forEach((input, index) => {
            if (index < sampleChallenges.length) {
                input.value = sampleChallenges[index];
            }
        });
    }

    async loadGames() {
        try {
            this.showLoading();

            const response = await fetch(`${CONFIG.API_BASE_URL}/games`, {
                headers: this.authManager.getAuthHeaders()
            });

            if (response.ok) {
                this.games = await response.json();
                this.renderGames();
            } else {
                throw new Error('Failed to load games');
            }
        } catch (error) {
            console.error('Error loading games:', error);
            this.showError('Failed to load games. Please try again.');
            this.showEmptyState();
        }
    }

    showLoading() {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('gamesGrid').style.display = 'none';
    }

    showEmptyState() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('gamesGrid').style.display = 'none';
    }

    renderGames() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const gamesGrid = document.getElementById('gamesGrid');

        loadingState.style.display = 'none';

        if (this.games.length === 0) {
            emptyState.style.display = 'block';
            gamesGrid.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        gamesGrid.style.display = 'grid';

        gamesGrid.innerHTML = '';

        this.games.forEach(game => {
            const gameCard = this.createGameCard(game);
            gamesGrid.appendChild(gameCard);
        });
    }

    createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = game.id;

        const createdDate = new Date(game.createdAt).toLocaleDateString();
        const gameUrl = `${window.location.origin}/play/${game.id}`;

        card.innerHTML = `
            <div class="game-card-header">
                <h3 class="game-card-title">${this.escapeHtml(game.name)}</h3>
                <span class="game-status ${game.isPublic ? 'public' : 'private'}">
                    ${game.isPublic ? 'Public' : 'Private'}
                </span>
            </div>
            <div class="game-card-meta">
                Created ${createdDate} • 25 challenges
            </div>
            <div class="game-card-url">
                ${gameUrl}
            </div>
            <div class="game-card-actions">
                <button class="btn btn-outline" onclick="window.adminDashboard.showGameActions('${game.id}')">
                    Actions
                </button>
                <button class="btn btn-primary" onclick="window.adminDashboard.viewGame('${game.id}')">
                    <span class="btn-icon">👁</span>
                    View
                </button>
            </div>
        `;

        return card;
    }

    showCreateGameModal() {
        document.getElementById('createGameModal').style.display = 'block';
    }

    hideCreateGameModal() {
        document.getElementById('createGameModal').style.display = 'none';
        document.getElementById('createGameForm').reset();
        this.setupChallengesGrid(); // Reset challenges grid
    }

    async handleCreateGame(e) {
        e.preventDefault();

        try {
            const formData = new FormData(e.target);
            const name = formData.get('gameName');
            const isPublic = formData.get('gameVisibility') === 'true';

            // Collect challenges
            const challengeInputs = document.querySelectorAll('.challenge-input');
            const challenges = Array.from(challengeInputs).map(input => input.value.trim());

            // Validate challenges
            if (challenges.some((challenge, index) => !challenge && index !== 12)) {
                this.showError('Please fill in all challenges (except the center FREE square).');
                return;
            }

            // Create game
            const response = await fetch(`${CONFIG.API_BASE_URL}/games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.authManager.getAuthHeaders()
                },
                body: JSON.stringify({
                    name,
                    challenges,
                    isPublic
                })
            });

            if (response.ok) {
                const newGame = await response.json();
                this.hideCreateGameModal();
                this.showSuccess('Game created successfully!');
                await this.loadGames(); // Reload games list

                // Track game creation
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'game_created', {
                        'event_category': 'engagement',
                        'event_label': 'admin_dashboard',
                        'value': 1
                    });
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create game');
            }
        } catch (error) {
            console.error('Error creating game:', error);
            this.showError('Failed to create game: ' + error.message);
        }
    }

    showGameActions(gameId) {
        this.currentGameId = gameId;
        const game = this.games.find(g => g.id === gameId);
        if (game) {
            document.getElementById('gameActionsTitle').textContent = game.name;
            document.getElementById('gameActionsModal').style.display = 'block';
        }
    }

    viewGame(gameId = null) {
        const id = gameId || this.currentGameId;
        if (id) {
            window.open(`/play/${id}`, '_blank');
            document.getElementById('gameActionsModal').style.display = 'none';
        }
    }

    editGame() {
        // TODO: Implement edit functionality
        this.showError('Edit functionality coming soon!');
        document.getElementById('gameActionsModal').style.display = 'none';
    }

    copyGameLink() {
        if (this.currentGameId) {
            const gameUrl = `${window.location.origin}/play/${this.currentGameId}`;
            navigator.clipboard.writeText(gameUrl).then(() => {
                this.showSuccess('Game link copied to clipboard!');
            }).catch(() => {
                this.showError('Failed to copy link. Please copy manually.');
            });
            document.getElementById('gameActionsModal').style.display = 'none';
        }
    }

    async deleteGame() {
        if (!this.currentGameId) return;

        const game = this.games.find(g => g.id === this.currentGameId);
        if (!game) return;

        if (!confirm(`Are you sure you want to delete "${game.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/games/${this.currentGameId}`, {
                method: 'DELETE',
                headers: this.authManager.getAuthHeaders()
            });

            if (response.ok) {
                this.showSuccess('Game deleted successfully!');
                await this.loadGames();
            } else {
                throw new Error('Failed to delete game');
            }
        } catch (error) {
            console.error('Error deleting game:', error);
            this.showError('Failed to delete game. Please try again.');
        }

        document.getElementById('gameActionsModal').style.display = 'none';
    }

    logout() {
        this.authManager.logout();
        window.location.href = '/index.html';
    }

    showSuccess(message) {
        this.showStatus(message, 'success');
    }

    showError(message) {
        this.showStatus(message, 'error');
    }

    showStatus(message, type = 'success') {
        const status = document.getElementById('adminStatus');
        if (status) {
            status.textContent = message;
            status.className = `status ${type}`;
            status.style.display = 'block';

            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});