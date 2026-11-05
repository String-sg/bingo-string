import { ChallengeLoader } from './challengeLoader.js';
import { BingoGrid } from './bingoGrid.js';
import { CameraManager } from './cameraManager.js';
import { TouchManager } from './touchManager.js';
import { ModalManager } from './modalManager.js';
import { AuthManager } from './authManager.js';
import { CONFIG, getConfig } from './config.js';

class BingoApp {
    constructor() {
        this.challengeLoader = new ChallengeLoader();
        this.bingoGrid = null;
        this.cameraManager = new CameraManager();
        this.touchManager = null;
        this.modalManager = new ModalManager(this.cameraManager);
        this.authManager = new AuthManager();
        this.sessionId = null;
        this.gameId = null;
        this.playerName = null;

        this.init();
    }

    async init() {
        try {
            // Load configuration first
            console.log('🔧 Loading configuration...');
            const config = await getConfig();
            console.log('🔧 Configuration loaded:', config);
            console.log('🔧 Google Client ID from config:', config.GOOGLE_CLIENT_ID);

            // Check for custom game URL: /play/{uuid}
            const pathParts = window.location.pathname.split('/').filter(p => p);
            if (pathParts.length >= 2 && pathParts[0] === 'play') {
                this.gameId = pathParts[1];
                await this.loadCustomGame(this.gameId);
            } else if (pathParts.length >= 2 && pathParts[0].includes('@')) {
                // Legacy support for email/uuid format
                this.gameId = pathParts[1];
                await this.loadCustomGame(this.gameId);
            } else {
                // Default game - initialize tracking
                await this.setupGrid();
                await this.initializeDefaultGameSession();
            }

            if (this.gameUnavailable) { const actions=document.querySelector('.footer .button-row');if(actions)actions.hidden=true;return; }
            this.setupEventListeners();
            if (!this.gameUnavailable) this.setupTouchManager();
            if (!this.gameUnavailable) this.loadCellImages(); // Load only this game/session
            this.setupAnalytics(); // Initialize Google Analytics
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to load the game. Please refresh the page.');
        }
    }

    async setupAnalytics() {
        try {
            const config = await getConfig();
            const gaId = config.GOOGLE_ANALYTICS_ID;

            if (gaId) {
                // Load GA script
                const script = document.createElement('script');
                script.async = true;
                script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
                document.head.appendChild(script);

                // Initialize dataLayer
                window.dataLayer = window.dataLayer || [];
                function gtag() { dataLayer.push(arguments); }
                window.gtag = gtag; // Make it global
                gtag('js', new Date());
                gtag('config', gaId);

                console.log('📊 Google Analytics initialized');
            }
        } catch (error) {
            console.warn('Failed to setup analytics:', error);
        }
    }

    async setupGrid(customChallenges = null, gridSize = 5) {
        const gridContainer = document.querySelector('.bingo-grid');
        if (!gridContainer) {
            throw new Error('Bingo grid container not found');
        }

        this.bingoGrid = new BingoGrid(gridContainer, this.challengeLoader);
        await this.bingoGrid.createGrid(customChallenges, gridSize);
    }

    async loadCustomGame(gameId) {
        try {
            console.log(`🎮 Loading custom game: ${gameId}`);
            const response = await fetch(`${(await getConfig()).API_BASE_URL}/games/${gameId}/play`);

            if (!response.ok) {
                throw new Error('Game not found');
            }

            const game = await response.json();
            console.log('🎮 Game loaded:', game);

            // Update page title
            document.title = `${game.name} - Bingo`;

            // Update UI to show this is a custom game
            const footer = document.querySelector('.footer');
            if (footer) {
                const info = document.createElement('p');
                info.style.color = '#666';
                info.textContent = `Playing: ${game.name} (Created by ${game.creator.name})`;
                footer.insertBefore(info, footer.firstChild);
            }

            // Setup grid with custom challenges
            await this.setupGrid(game.challengesJson, game.gridSize || 5);

            // Initialize session
            if (!new URLSearchParams(location.search).has('preview')) this.initializeSession();
            else { const hint=document.createElement('p');hint.textContent='Board preview — no player entry is recorded.';document.querySelector('.footer')?.prepend(hint); }

        } catch (error) {
            console.error('Failed to load custom game:', error);
            this.showError('Failed to load the game. It might be private or deleted.');
            const grid=document.getElementById('bingoGrid');grid.replaceChildren();const message=document.createElement('p');message.textContent='Game unavailable. Check the link with your host or try again later.';grid.append(message);
            this.gameUnavailable=true;
        }
    }

    setupEventListeners() {
        // Grid cell clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.bingo-cell')) {
                const cell = e.target.closest('.bingo-cell');
                const index = parseInt(cell.dataset.index);
                this.handleCellClick(index);
            }
        });

        // Camera modal events
        const switchCameraBtn = document.getElementById('switchCameraBtn');
        if (switchCameraBtn) {
            switchCameraBtn.addEventListener('click', () => this.cameraManager.switchCamera());
        }

        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.modalManager.capturePhoto());
        }

        // Upload button in camera modal
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                document.getElementById('cameraFileInput').click();
            });
        }

        // File upload from camera modal
        const cameraFileInput = document.getElementById('cameraFileInput');
        if (cameraFileInput) {
            cameraFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.modalManager.handleFileUpload(file);
                }
            });
        }



        // Bingo modal events
        const celebrateBtn = document.getElementById('celebrateBtn');
        if (celebrateBtn) {
            celebrateBtn.addEventListener('click', () => this.modalManager.closeModal());
        }

        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        // Recenter button
        const recenterBtn = document.getElementById('recenterBtn');
        if (recenterBtn) {
            recenterBtn.addEventListener('click', () => this.recenter());
        }

        // Download all images button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadAllImages());
        }

        // Auth related buttons
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            authBtn.addEventListener('click', () => this.authManager.showAuthModal());
        }

        const makeYourOwnBtn = document.getElementById('makeYourOwnBtn');
        if (makeYourOwnBtn) {
            makeYourOwnBtn.addEventListener('click', () => this.authManager.redirectToAdmin());
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.authManager.logout());
        }

        // Auth modal close button
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') && e.target.closest('#authModal')) {
                this.authManager.closeAuthModal();
            }

            // Close auth modal when clicking outside
            if (e.target.id === 'authModal') {
                this.authManager.closeAuthModal();
            }
        });


    }

    setupTouchManager() {
        const gridContainer = document.querySelector('.grid-container');
        if (gridContainer) {
            this.touchManager = new TouchManager(gridContainer);
        }
    }

    handleCellClick(index) {
        if (!this.bingoGrid || (this.gameId && !this.sessionId)) return;
        const cell = this.bingoGrid.cells[index];
        const isCompleted = cell.classList.contains('completed');

        if (isCompleted) {
            // If already completed, show the photo in a modal
            this.showPhotoModal(index);
        } else {
            // Directly start camera for completion
            this.modalManager.showCameraModal(index);
        }
    }

    handleImageConfirm() {
        const cellIndex = this.modalManager.getCurrentCellIndex();
        const imageData = this.modalManager.getCurrentImageData();

        if (cellIndex !== null && imageData) {
            // Mark cell as completed
            this.bingoGrid.setCellCompleted(cellIndex);

            // Store image data (you could save this to localStorage or send to server)
            this.storeCellImage(cellIndex, imageData);

            // Close modal and clear data
            this.modalManager.closeModal();
            this.modalManager.clearCurrentData();

            // Check for bingo
            if (this.bingoGrid.checkForBingo()) {
                this.handleBingo();
            }

            // Update session progress
            this.updateSessionProgress();
        }
    }

    async initializeSession() {
        if (!this.gameId) return;

        const storageKey = `bingoSession_${this.gameId}`;
        const storedSession = localStorage.getItem(storageKey);

        if (storedSession) {
            const session = JSON.parse(storedSession);
            this.sessionId = session.sessionId;
            this.playerName = session.playerName;
            console.log(`Resuming session for ${this.playerName}`);
            this.joinGameSession();
        } else {
            // Prompt for name
            this.modalManager.showNamePrompt((name) => {
                this.playerName = name;
                this.sessionId = crypto.randomUUID();

                // Store session locally
                localStorage.setItem(storageKey, JSON.stringify({
                    sessionId: this.sessionId,
                    playerName: this.playerName
                }));

                this.joinGameSession();
                this.loadCellImages();
            });
        }
    }

    async initializeDefaultGameSession() {
        const storageKey = 'defaultBingoSession';
        const storedSession = localStorage.getItem(storageKey);

        if (storedSession) {
            const session = JSON.parse(storedSession);
            this.sessionId = session.sessionId;
            console.log('Resuming default game session');
        } else {
            // Generate new session for default game
            this.sessionId = crypto.randomUUID();

            // Store session locally
            localStorage.setItem(storageKey, JSON.stringify({
                sessionId: this.sessionId,
                createdAt: new Date().toISOString()
            }));

            console.log('Created new default game session');
        }

        // Create session in backend
        await this.createDefaultGameSession();

        // Track game start in Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'default_game_start', {
                'event_category': 'engagement',
                'event_label': 'default_bingo',
                'value': 1
            });
        }
    }

    async joinGameSession() {
        try {
            const response = await fetch(`${(await getConfig()).API_BASE_URL}/games/${this.gameId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    playerName: this.playerName
                })
            });

            if (response.ok) {
                const session = await response.json();
                console.log('Joined game session:', session);

                // Restore progress if available (optional, for now we rely on local storage for immediate state)
                // But we could sync from server here if we wanted cross-device support
            }
        } catch (error) {
            console.error('Failed to join session:', error);
        }
    }

    async createDefaultGameSession() {
        try {
            const config = await getConfig();
            const response = await fetch(`${config.API_BASE_URL}/default-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    challengeSet: CONFIG.CHALLENGE_FILE,
                    gridSize: this.bingoGrid.gridSize
                })
            });

            if (response.ok) {
                const session = await response.json();
                console.log('Created default game session:', session);
            } else {
                console.error('Failed to create default session:', response.status);
            }
        } catch (error) {
            console.error('Error creating default session:', error);
        }
    }

    async updateSessionProgress() {
        if (!this.sessionId) return;

        try {
            const completedCells = this.bingoGrid.getCompletedCells();
            const isCompleted = this.bingoGrid.bingoLines.length > 0;

            if (this.gameId) {
                // Custom game progress
                await fetch(`${(await getConfig()).API_BASE_URL}/games/${this.gameId}/progress`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: this.sessionId,
                        progressJson: completedCells,
                        isCompleted
                    })
                });
            } else {
                // Default game progress
                await this.updateDefaultGameProgress(completedCells, isCompleted);
            }
        } catch (error) {
            console.error('Failed to update progress:', error);
        }
    }

    async updateDefaultGameProgress(completedCells, isCompleted) {
        try {
            const config = await getConfig();
            const response = await fetch(`${config.API_BASE_URL}/default-sessions/${this.sessionId}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    progressJson: completedCells,
                    isCompleted
                })
            });

            if (response.ok) {
                console.log('Updated default game progress');

                // Track completion in Google Analytics
                if (isCompleted && typeof gtag !== 'undefined') {
                    gtag('event', 'default_game_completed', {
                        'event_category': 'engagement',
                        'event_label': 'default_bingo',
                        'value': completedCells.length
                    });
                }
            } else {
                console.error('Failed to update default progress:', response.status);
            }
        } catch (error) {
            console.error('Error updating default progress:', error);
        }
    }

    photoStorageKey() { return `bingo:photos:v2:${this.gameId || CONFIG.CHALLENGE_FILE}:${this.sessionId || 'preview'}`; }

    storeCellImage(cellIndex, imageData) {
        // Store in localStorage for persistence
        const cellImages = JSON.parse(localStorage.getItem(this.photoStorageKey()) || '{}');
        cellImages[cellIndex] = imageData;
        localStorage.setItem(this.photoStorageKey(), JSON.stringify(cellImages));

        // Immediately apply the image to the cell
        const cell = this.bingoGrid.cells[cellIndex];
        if (cell) {
            cell.style.backgroundImage = `url(${imageData})`;
            cell.style.backgroundSize = 'cover';
            cell.style.backgroundPosition = 'center';
            cell.classList.add('has-image');
        }

        // Track photo taken event in Google Analytics
        if (typeof gtag !== 'undefined') {
            const eventLabel = this.gameId ? `custom_cell_${cellIndex}` : `default_cell_${cellIndex}`;
            const eventName = this.gameId ? 'photo_taken' : 'default_cell_completed';

            gtag('event', eventName, {
                'event_category': 'engagement',
                'event_label': eventLabel,
                'value': 1
            });
        }
    }

    loadCellImages() {
        const cellImages = JSON.parse(localStorage.getItem(this.photoStorageKey()) || '{}');
        if (!this.bingoGrid) return;
        Object.entries(cellImages).forEach(([index, imageData]) => {
            if (typeof imageData !== 'string' || !/^data:image\//.test(imageData)) return;
            const cellIndex = parseInt(index);
            const cell = this.bingoGrid.cells[cellIndex];
            if (cell) {
                cell.style.backgroundImage = `url(${imageData})`;
                cell.style.backgroundSize = 'cover';
                cell.style.backgroundPosition = 'center';
                cell.classList.add('has-image');
                this.bingoGrid.completedCells.add(cellIndex);
                cell.classList.add('completed');
                cell.setAttribute('aria-pressed','true');
            }
        });
        this.bingoGrid.checkForBingo();
    }

    showPhotoModal(cellIndex) {
        const cellImages = JSON.parse(localStorage.getItem(this.photoStorageKey()) || '{}');
        const imageData = cellImages[cellIndex];

        if (imageData) {
            // Create a modal to show the photo
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';

            const challenge = this.bingoGrid.challenges[cellIndex];
            const challengeText = challenge ? challenge.text : `Challenge ${cellIndex + 1}`;

            modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-label','Challenge photo'); modal.tabIndex=-1;
            const content=document.createElement('div');content.className='modal-content';
            const title=document.createElement('h2');title.textContent=challengeText;
            const image=document.createElement('img');image.alt='Challenge proof';image.className='preview-image';image.src=imageData;
            const close=document.createElement('button');close.type='button';close.className='btn btn-secondary';close.textContent='Close';close.onclick=()=>{modal.remove();this.bingoGrid.cells[cellIndex]?.focus();};
            const remove=document.createElement('button');remove.type='button';remove.className='btn btn-danger';remove.textContent='Remove photo';remove.onclick=()=>this.removeCellImage(cellIndex);
            content.append(title,image,close,remove);modal.append(content);
            modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close.click();}if(e.key==='Tab'){e.preventDefault();(document.activeElement===close?remove:close).focus();}});
            document.body.appendChild(modal);
            modal.focus();

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    }

    removeCellImage(cellIndex) {
        // Remove from localStorage
        const cellImages = JSON.parse(localStorage.getItem(this.photoStorageKey()) || '{}');
        delete cellImages[cellIndex];
        localStorage.setItem(this.photoStorageKey(), JSON.stringify(cellImages));

        // Remove background image from cell
        const cell = this.bingoGrid.cells[cellIndex];
        if (cell) {
            cell.style.backgroundImage = '';
            cell.classList.remove('has-image');
        }

        // Mark cell as incomplete
        this.bingoGrid.setCellIncomplete(cellIndex);

        // Close modal
        document.querySelector('[aria-label="Challenge photo"]')?.remove();
        this.updateSessionProgress();
        this.bingoGrid.cells[cellIndex]?.focus();
    }

    handleBingo() {
        // Show bingo celebration
        this.modalManager.showBingoCelebration();
    }

    reset() {
        // Clear localStorage
        localStorage.removeItem(this.photoStorageKey());

        // Reset grid
        this.bingoGrid.reset();
        this.updateSessionProgress();

        // Reset touch manager
        if (this.touchManager) {
            this.touchManager.reset();
        }

        // Clear any modals
        this.modalManager.closeModal();
        this.modalManager.clearCurrentData();

        // Remove background images from cells
        this.bingoGrid.cells.forEach(cell => {
            cell.style.backgroundImage = '';
            cell.classList.remove('has-image');
        });
    }

    recenter() {
        // Recenter the grid view
        if (this.touchManager) {
            this.touchManager.recenter();
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;

        const container = document.querySelector('.grid-container');
        if (container) {
            container.parentNode.insertBefore(errorDiv, container);
        }
    }

    getStatus() {
        const completedCells = this.bingoGrid.getCompletedCells();
        const totalCells = this.bingoGrid.gridSize * this.bingoGrid.gridSize;
        return {
            completed: completedCells.length,
            total: totalCells,
            percentage: Math.round((completedCells.length / totalCells) * 100)
        };
    }

    async downloadAllImages() {
        const cellImages = JSON.parse(localStorage.getItem(this.photoStorageKey()) || '{}');
        const imageEntries = Object.entries(cellImages);

        if (imageEntries.length === 0) {
            alert('No images to download. Complete some challenges first!');
            return;
        }

        // For a single image, download directly
        if (imageEntries.length === 1) {
            const [index, imageData] = imageEntries[0];
            const challenge = this.bingoGrid.challenges[parseInt(index)];
            const challengeText = challenge ? challenge.text : `Challenge ${parseInt(index) + 1}`;
            this.downloadSingleImage(imageData, `bingo-${parseInt(index) + 1}-${challengeText.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`);

            // Track download event in Google Analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', 'download_images', {
                    'event_category': 'engagement',
                    'event_label': 'single_image',
                    'value': 1
                });
            }
            return;
        }

        // For multiple images, create ZIP
        try {
            const JSZip = await this.loadJSZip();
            const zip = new JSZip();

            for (const [index, imageData] of imageEntries) {
                const challenge = this.bingoGrid.challenges[parseInt(index)];
                const challengeText = challenge ? challenge.text : `Challenge ${parseInt(index) + 1}`;
                const filename = `bingo-${parseInt(index) + 1}-${challengeText.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;

                // Convert data URL to blob
                const response = await fetch(imageData);
                const blob = await response.blob();
                zip.file(filename, blob);
            }

            // Generate ZIP and download
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bingo-images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Track download event in Google Analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', 'download_images', {
                    'event_category': 'engagement',
                    'event_label': 'zip_file',
                    'value': imageEntries.length
                });
            }
        } catch (error) {
            console.error('Error downloading images:', error);
            alert('Error downloading images. Please try again.');
        }
    }

    downloadSingleImage(imageData, filename) {
        const a = document.createElement('a');
        a.href = imageData;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async loadJSZip() {
        if (window.JSZip) {
            return window.JSZip;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error('Failed to load JSZip'));
            document.head.appendChild(script);
        });
    }

    handleCreateNewGame() {
        // Navigate to the dedicated game creation page
        window.location.href = '/new.html';

        // Track create game intent
        if (typeof gtag !== 'undefined') {
            gtag('event', 'create_game_intent', {
                'event_category': 'engagement',
                'event_label': 'admin_dashboard',
                'value': 1
            });
        }
    }

}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bingoApp = new BingoApp();
}); 