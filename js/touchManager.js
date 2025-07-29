import { CONFIG } from './config.js';

export class TouchManager {
    constructor(gridContainer) {
        this.gridContainer = gridContainer;
        this.grid = gridContainer.querySelector('.bingo-grid');
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.lastTouchDistance = 0;
        this.lastTouchCenter = { x: 0, y: 0 };

        this.initTouchEvents();
    }

    initTouchEvents() {
        this.gridContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.gridContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.gridContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    }

    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastTouchCenter = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        } else if (e.touches.length === 2) {
            this.isDragging = false;
            this.lastTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
            this.lastTouchCenter = this.getTouchCenter(e.touches[0], e.touches[1]);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();

        if (e.touches.length === 1 && this.isDragging) {
            // Pan
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.lastTouchCenter.x;
            const deltaY = touch.clientY - this.lastTouchCenter.y;

            this.translateX += deltaX;
            this.translateY += deltaY;

            this.lastTouchCenter = {
                x: touch.clientX,
                y: touch.clientY
            };

            this.updateTransform();
        } else if (e.touches.length === 2) {
            // Pinch to zoom
            const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
            const currentCenter = this.getTouchCenter(e.touches[0], e.touches[1]);

            const scaleDelta = currentDistance / this.lastTouchDistance;
            const newScale = Math.max(CONFIG.ZOOM.min, Math.min(CONFIG.ZOOM.max, this.scale * scaleDelta));

            // Calculate zoom center offset
            const scaleChange = newScale / this.scale;
            const centerOffsetX = (currentCenter.x - this.lastTouchCenter.x) * (1 - scaleChange);
            const centerOffsetY = (currentCenter.y - this.lastTouchCenter.y) * (1 - scaleChange);

            this.scale = newScale;
            this.translateX += centerOffsetX;
            this.translateY += centerOffsetY;

            this.lastTouchDistance = currentDistance;
            this.lastTouchCenter = currentCenter;

            this.updateTransform();
        }
    }

    handleTouchEnd(e) {
        this.isDragging = false;
    }

    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }

    updateTransform() {
        this.grid.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }

    reset() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
    }
} 