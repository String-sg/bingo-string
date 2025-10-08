import { ChallengeLoader } from './challengeLoader.js';
import { BingoGrid } from './bingoGrid.js';
import { CameraManager } from './cameraManager.js';
import { TouchManager } from './touchManager.js';
import { ModalManager } from './modalManager.js';
import { AuthManager } from './authManager.js';
import { getConfig } from './config.js';

class BingoApp {
    constructor() {
        this.challengeLoader = new ChallengeLoader();
        this.bingoGrid = null;
        this.cameraManager = new CameraManager();
        this.touchManager = null;
        this.modalManager = new ModalManager(this.cameraManager);
        this.authManager = new AuthManager();

        this.init();
    }

    async init() {
        try {
            // Load configuration first
            console.log('🔧 Loading configuration...');
            const config = await getConfig();
            console.log('🔧 Configuration loaded:', config);
            console.log('🔧 Google Client ID from config:', config.GOOGLE_CLIENT_ID);

            await this.setupGrid();
            this.setupEventListeners();
            this.setupTouchManager();
            this.loadCellImages(); // Load saved images on startup
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to load the game. Please refresh the page.');
        }
    }

    async setupGrid() {
        const gridContainer = document.querySelector('.bingo-grid');
        if (!gridContainer) {
            throw new Error('Bingo grid container not found');
        }

        this.bingoGrid = new BingoGrid(gridContainer, this.challengeLoader);
        await this.bingoGrid.createGrid();
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

        // Admin dashboard buttons
        const backToGameBtn = document.getElementById('backToGameBtn');
        if (backToGameBtn) {
            backToGameBtn.addEventListener('click', () => this.authManager.hideAdminDashboard());
        }

        const createNewGameBtn = document.getElementById('createNewGameBtn');
        const createNewGameBtn2 = document.getElementById('createNewGameBtn2');

        if (createNewGameBtn) {
            createNewGameBtn.addEventListener('click', () => this.handleCreateNewGame());
        }

        if (createNewGameBtn2) {
            createNewGameBtn2.addEventListener('click', () => this.handleCreateNewGame());
        }
    }

    setupTouchManager() {
        const gridContainer = document.querySelector('.grid-container');
        if (gridContainer) {
            this.touchManager = new TouchManager(gridContainer);
        }
    }

    handleCellClick(index) {
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
        }
    }

    storeCellImage(cellIndex, imageData) {
        // Store in localStorage for persistence
        const cellImages = JSON.parse(localStorage.getItem('bingoCellImages') || '{}');
        cellImages[cellIndex] = imageData;
        localStorage.setItem('bingoCellImages', JSON.stringify(cellImages));

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
            gtag('event', 'photo_taken', {
                'event_category': 'engagement',
                'event_label': `cell_${cellIndex}`,
                'value': 1
            });
        }
    }

    loadCellImages() {
        const cellImages = JSON.parse(localStorage.getItem('bingoCellImages') || '{}');
        Object.entries(cellImages).forEach(([index, imageData]) => {
            const cellIndex = parseInt(index);
            const cell = this.bingoGrid.cells[cellIndex];
            if (cell) {
                cell.style.backgroundImage = `url(${imageData})`;
                cell.style.backgroundSize = 'cover';
                cell.style.backgroundPosition = 'center';
                cell.classList.add('has-image');
            }
        });
    }

    showPhotoModal(cellIndex) {
        const cellImages = JSON.parse(localStorage.getItem('bingoCellImages') || '{}');
        const imageData = cellImages[cellIndex];

        if (imageData) {
            // Create a modal to show the photo
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';

            const challenge = this.challengeLoader.getChallenge(cellIndex);
            const challengeText = challenge ? challenge.text : `Challenge ${cellIndex + 1}`;

            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    <h2>${challengeText}</h2>
                    <div class="preview-container">
                        <img src="${imageData}" class="preview-image" alt="Challenge proof">
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                        <button class="btn btn-danger" onclick="window.bingoApp.removeCellImage(${cellIndex})">Remove Photo</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

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
        const cellImages = JSON.parse(localStorage.getItem('bingoCellImages') || '{}');
        delete cellImages[cellIndex];
        localStorage.setItem('bingoCellImages', JSON.stringify(cellImages));

        // Remove background image from cell
        const cell = this.bingoGrid.cells[cellIndex];
        if (cell) {
            cell.style.backgroundImage = '';
            cell.classList.remove('has-image');
        }

        // Mark cell as incomplete
        this.bingoGrid.setCellIncomplete(cellIndex);

        // Close modal
        document.querySelector('.modal').remove();
    }

    handleBingo() {
        // Show bingo celebration
        this.modalManager.showBingoCelebration();
    }

    reset() {
        // Clear localStorage
        localStorage.removeItem('bingoCellImages');

        // Reset grid
        this.bingoGrid.reset();

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
        return {
            completed: completedCells.length,
            total: 25,
            percentage: Math.round((completedCells.length / 25) * 100)
        };
    }

    async downloadAllImages() {
        const cellImages = JSON.parse(localStorage.getItem('bingoCellImages') || '{}');
        const imageEntries = Object.entries(cellImages);
        
        if (imageEntries.length === 0) {
            alert('No images to download. Complete some challenges first!');
            return;
        }

        // For a single image, download directly
        if (imageEntries.length === 1) {
            const [index, imageData] = imageEntries[0];
            const challenge = this.challengeLoader.getChallenge(parseInt(index));
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
                const challenge = this.challengeLoader.getChallenge(parseInt(index));
                const challengeText = challenge ? challenge.text : `Challenge ${parseInt(index) + 1}`;
                const filename = `bingo-${parseInt(index) + 1}-${challengeText.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
                
                // Convert data URL to blob
                const response = await fetch(imageData);
                const blob = await response.blob();
                zip.file(filename, blob);
            }

            // Generate ZIP and download
            const zipBlob = await zip.generateAsync({type: 'blob'});
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
        // Hide admin dashboard and show game creation form
        this.authManager.hideAdminDashboard();
        this.showGameCreationForm();

        // Track create game intent
        if (typeof gtag !== 'undefined') {
            gtag('event', 'create_game_intent', {
                'event_category': 'engagement',
                'event_label': 'admin_dashboard',
                'value': 1
            });
        }
    }

    showGameCreationForm() {
        const gameCreationForm = document.getElementById('gameCreationForm');
        if (gameCreationForm) {
            gameCreationForm.style.display = 'block';
            this.initializeBingoEditor();
        }
    }

    hideGameCreationForm() {
        const gameCreationForm = document.getElementById('gameCreationForm');
        if (gameCreationForm) {
            gameCreationForm.style.display = 'none';
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bingoApp = new BingoApp();
}); 