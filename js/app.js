import { ChallengeLoader } from './challengeLoader.js';
import { BingoGrid } from './bingoGrid.js';
import { CameraManager } from './cameraManager.js';
import { TouchManager } from './touchManager.js';
import { ModalManager } from './modalManager.js';

class BingoApp {
    constructor() {
        this.challengeLoader = new ChallengeLoader();
        this.bingoGrid = null;
        this.cameraManager = new CameraManager();
        this.touchManager = null;
        this.modalManager = new ModalManager(this.cameraManager);

        this.init();
    }

    async init() {
        try {
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
        const cameraBtn = document.getElementById('cameraBtn');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => this.modalManager.showCameraModal());
        }

        const switchCameraBtn = document.getElementById('switchCameraBtn');
        if (switchCameraBtn) {
            switchCameraBtn.addEventListener('click', () => this.cameraManager.switchCamera());
        }

        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.modalManager.capturePhoto());
        }

        // File upload
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.modalManager.handleFileUpload(file);
                }
            });
        }

        // Preview modal events
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.modalManager.deleteImage());
        }

        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.handleImageConfirm());
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
            // Show options modal for completion
            this.modalManager.showOptionsModal(index);
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bingoApp = new BingoApp();
}); 