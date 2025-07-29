import { CONFIG } from './config.js';

export class CameraManager {
    constructor() {
        this.stream = null;
        this.videoElement = null;
        this.currentFacingMode = 'environment';
    }

    async startCamera(videoElement) {
        this.videoElement = videoElement;

        try {
            const constraints = {
                video: {
                    ...CONFIG.CAMERA,
                    facingMode: this.currentFacingMode
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;

            return true;
        } catch (error) {
            console.error('Error starting camera:', error);
            throw error;
        }
    }

    async switchCamera() {
        if (!this.stream) return;

        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';

        // Stop current stream
        this.stopCamera();

        // Start new stream
        await this.startCamera(this.videoElement);
    }

    capturePhoto() {
        if (!this.videoElement || !this.stream) {
            throw new Error('Camera not started');
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;

        context.drawImage(this.videoElement, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.8);
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
    }

    handleFileUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const imageData = e.target.result;
                resolve(imageData);
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    resizeImage(imageData, maxWidth = 800, maxHeight = 600) {
        return new Promise((resolve) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                let { width, height } = img;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                context.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };

            img.src = imageData;
        });
    }
} 