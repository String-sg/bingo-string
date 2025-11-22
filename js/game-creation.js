import { getConfig } from './config.js';
import { AuthManager } from './authManager.js';

class GameCreationApp {
    constructor() {
        this.config = null;
        this.authManager = new AuthManager();
        this.init();
    }

    async init() {
        try {
            // Load configuration
            console.log('🔧 Loading configuration for game creation...');
            this.config = await getConfig();
            console.log('🔧 Configuration loaded:', this.config.ENVIRONMENT);

            this.setupEventListeners();
            this.initializeBingoEditor();
        } catch (error) {
            console.error('Failed to initialize game creation app:', error);
            this.showError('Failed to load the game creation page. Please refresh.');
        }
    }

    setupEventListeners() {
        // Create Game button
        const createGameBtn = document.getElementById('createGameBtn');
        if (createGameBtn) {
            createGameBtn.addEventListener('click', () => this.handleGameSubmit());
        }

        // Edit Questions button
        const editQuestionsBtn = document.getElementById('editQuestionsBtn');
        if (editQuestionsBtn) {
            editQuestionsBtn.addEventListener('click', () => this.toggleEditMode());
        }

        // CSV Import button
        const importCsvBtn = document.getElementById('importCsvBtn');
        if (importCsvBtn) {
            importCsvBtn.addEventListener('click', () => this.handleCsvImport());
        }

        // Focus game name input on load
        const gameNameInput = document.getElementById('gameName');
        if (gameNameInput) {
            gameNameInput.focus();
        }
    }

    initializeBingoEditor() {
        const gridContainer = document.getElementById('bingoEditorGrid');
        if (!gridContainer) return;

        // Clear existing grid
        gridContainer.innerHTML = '';

        // Create 5x5 grid of editable cells
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('textarea');
            cell.className = 'editor-cell';
            cell.dataset.index = i;

            // Center cell (index 12) is FREE
            if (i === 12) {
                cell.className += ' free-cell';
                cell.value = 'FREE';
                cell.disabled = true;
                cell.placeholder = '';
            } else {
                cell.placeholder = `Q${i + 1}`;
                cell.maxLength = 100;
            }

            gridContainer.appendChild(cell);
        }
    }

    async handleGameSubmit() {
        // Get game name
        const gameNameInput = document.getElementById('gameName');
        const gameName = gameNameInput?.value.trim();

        if (!gameName) {
            alert('Please enter a game name');
            gameNameInput?.focus();
            return;
        }

        // Get all questions from the grid
        const challenges = [];
        const cells = document.querySelectorAll('.editor-cell');

        cells.forEach((cell, index) => {
            let text = '';
            if (index === 12) {
                text = 'FREE'; // Center cell
            } else {
                text = cell.value.trim() || `Question ${index + 1}`;
            }

            challenges.push({
                id: `q${index}`,
                text: text
            });
        });

        try {
            const createBtn = document.getElementById('createGameBtn');
            if (createBtn) {
                createBtn.disabled = true;
                createBtn.textContent = 'Creating...';
            }

            const response = await fetch(`${this.config.API_BASE_URL}/games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.authManager.getAuthHeaders()
                },
                body: JSON.stringify({
                    name: gameName,
                    challenges: challenges,
                    isPublic: true
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create game: ${response.status}`);
            }

            const game = await response.json();
            console.log('Game created:', game);

            // Generate shareable link
            const shareLink = `${window.location.origin}/${game.creatorEmail}/${game.id}`;

            // Show success and redirect
            alert(`Game created successfully!\n\nShare this link:\n${shareLink}`);

            // Track game creation
            if (typeof gtag !== 'undefined') {
                gtag('event', 'game_created', {
                    'event_category': 'engagement',
                    'event_label': 'custom_game',
                    'value': 1
                });
            }

            // Redirect to the new game
            window.location.href = `/${game.creatorEmail}/${game.id}`;

        } catch (error) {
            console.error('Error creating game:', error);
            this.showError('Failed to create game. Please try again.');

            const createBtn = document.getElementById('createGameBtn');
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.textContent = 'Create Game';
            }
        }
    }

    toggleEditMode() {
        alert('You can edit any cell by clicking directly in it.');
    }

    handleCsvImport() {
        // Create hidden file input for CSV upload
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.csv';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importCsvFile(file);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    importCsvFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvText = e.target.result;
                const lines = csvText.split('\n').filter(line => line.trim());

                if (lines.length < 24) {
                    alert('CSV file must contain at least 24 questions (excluding the center FREE cell)');
                    return;
                }

                const cells = document.querySelectorAll('.editor-cell');
                let csvIndex = 0;

                cells.forEach((cell, index) => {
                    if (index !== 12) { // Skip center cell
                        if (csvIndex < lines.length) {
                            cell.value = lines[csvIndex].trim().replace(/"/g, '');
                            csvIndex++;
                        }
                    }
                });

                alert(`Successfully imported ${csvIndex} questions from CSV file!`);

            } catch (error) {
                console.error('CSV import error:', error);
                alert('Error reading CSV file. Please make sure it\'s a valid CSV with one question per line.');
            }
        };

        reader.readAsText(file);
    }

    getUserEmail() {
        // Try to get user email from localStorage (from auth session)
        try {
            const stored = localStorage.getItem('bingoAuth');
            if (stored) {
                const session = JSON.parse(stored);
                return session.user?.email;
            }
        } catch (error) {
            console.log('No auth session found');
        }
        return null;
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
}

// Initialize the game creation app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameCreationApp();
});