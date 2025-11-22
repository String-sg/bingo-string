export class ModalManager {
    constructor(cameraManager) {
        this.cameraManager = cameraManager;
        this.currentCellIndex = null;
        this.currentImageData = null;

        this.initModals();
    }

    initModals() {
        // Options Modal
        this.optionsModal = document.getElementById('optionsModal');
        this.cameraModal = document.getElementById('cameraModal');
        this.previewModal = document.getElementById('previewModal');
        this.bingoModal = document.getElementById('bingoModal');

        // Close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.closeModal());
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        });
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });

        // Stop camera when closing camera modal
        if (this.cameraModal.style.display === 'none') {
            this.cameraManager.stopCamera();
        }
    }

    showOptionsModal(cellIndex) {
        this.currentCellIndex = cellIndex;
        this.showModal('optionsModal');
    }

    async showCameraModal(cellIndex = null) {
        if (cellIndex !== null) {
            this.currentCellIndex = cellIndex;
        }

        this.showModal('cameraModal');

        const video = document.getElementById('video');
        try {
            await this.cameraManager.startCamera(video);
        } catch (error) {
            console.error('Failed to start camera:', error);
            this.showStatus('Camera access denied. Please use file upload instead.', 'error');
        }
    }

    async handleFileUpload(file) {
        try {
            this.currentImageData = await this.cameraManager.handleFileUpload(file);
            this.currentImageData = await this.cameraManager.resizeImage(this.currentImageData);
            this.confirmImage();
        } catch (error) {
            console.error('File upload error:', error);
            this.showStatus('Failed to upload file. Please try again.', 'error');
        }
    }

    async capturePhoto() {
        try {
            this.currentImageData = this.cameraManager.capturePhoto();
            this.currentImageData = await this.cameraManager.resizeImage(this.currentImageData);
            this.confirmImage();
        } catch (error) {
            console.error('Photo capture error:', error);
            this.showStatus('Failed to capture photo. Please try again.', 'error');
        }
    }

    confirmImage() {
        // Immediately process the image without showing preview modal
        this.closeModal();

        // Trigger the image confirmation in the main app
        if (window.bingoApp) {
            window.bingoApp.handleImageConfirm();
        }
    }

    deleteImage() {
        this.currentImageData = null;
        this.closeModal();
    }

    submitBingo() {
        // For now, just show celebration
        this.closeModal();
        this.showBingoCelebration();
    }

    showBingoCelebration() {
        this.showModal('bingoModal');
    }

    showStatus(message, type = 'success') {
        const statusElement = document.querySelector('.status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
            statusElement.style.display = 'block';

            setTimeout(() => {
                this.hideStatus();
            }, 3000);
        }
    }

    hideStatus() {
        const statusElement = document.querySelector('.status');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }

    updateSubmitButton(enabled) {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = !enabled;
            submitBtn.textContent = enabled ? 'Submit Bingo!' : 'Please fill all fields';
        }
    }

    getCurrentCellIndex() {
        return this.currentCellIndex;
    }

    getCurrentImageData() {
        return this.currentImageData;
    }

    showNamePrompt(callback) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.zIndex = '2000'; // Ensure it's on top

        modal.innerHTML = `
            <div class="modal-content">
                <h2>Welcome!</h2>
                <p>Please enter your name to join the game:</p>
                <input type="text" id="playerNameInput" placeholder="Your Name" style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 5px;">
                <button class="btn btn-primary" id="joinGameBtn" style="width: 100%;">Join Game</button>
            </div>
        `;

        document.body.appendChild(modal);

        const input = modal.querySelector('#playerNameInput');
        const btn = modal.querySelector('#joinGameBtn');

        const submit = () => {
            const name = input.value.trim();
            if (name) {
                modal.remove();
                callback(name);
            } else {
                input.style.borderColor = 'red';
            }
        };

        btn.addEventListener('click', submit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });

        // Focus input
        setTimeout(() => input.focus(), 100);
    }

    clearCurrentData() {
        this.currentCellIndex = null;
        this.currentImageData = null;
    }
} 