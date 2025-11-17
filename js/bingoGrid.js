import { CONFIG } from './config.js';

export class BingoGrid {
    constructor(container, challengeLoader) {
        this.container = container;
        this.challengeLoader = challengeLoader;
        this.cells = [];
        this.completedCells = new Set();
        this.bingoLines = [];
    }

    async createGrid() {
        const challenges = await this.challengeLoader.loadChallenges();

        this.container.innerHTML = '';
        this.cells = [];

        // Set CSS grid columns based on grid size
        this.container.style.gridTemplateColumns = `repeat(${CONFIG.GRID.size}, 1fr)`;

        for (let i = 0; i < CONFIG.GRID.size * CONFIG.GRID.size; i++) {
            const cell = this.createCell(i, challenges[i]);
            this.container.appendChild(cell);
            this.cells.push(cell);
        }
    }

    createCell(index, challenge) {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell';
        cell.dataset.index = index;

        // Center cell gets special styling
        if (index === CONFIG.GRID.centerIndex) {
            cell.classList.add('center-cell');
        }

        const number = document.createElement('div');
        number.className = 'cell-number';
        number.textContent = index + 1;

        const text = document.createElement('div');
        text.className = 'cell-text';
        text.textContent = challenge ? challenge.text : 'Free Space';

        cell.appendChild(number);
        cell.appendChild(text);

        return cell;
    }

    setCellCompleted(index) {
        if (index >= 0 && index < this.cells.length) {
            this.cells[index].classList.add('completed');
            this.completedCells.add(index);
            this.checkForBingo();
        }
    }

    setCellIncomplete(index) {
        if (index >= 0 && index < this.cells.length) {
            this.cells[index].classList.remove('completed');
            this.cells[index].style.backgroundImage = '';
            this.completedCells.delete(index);
            this.removeBingoHighlight();
        }
    }

    checkForBingo() {
        const lines = this.getBingoLines();

        for (const line of lines) {
            if (line.every(index => this.completedCells.has(index))) {
                this.highlightBingoLine(line);
                return true;
            }
        }

        return false;
    }

    getBingoLines() {
        const lines = [];

        // Rows
        for (let row = 0; row < CONFIG.GRID.size; row++) {
            const line = [];
            for (let col = 0; col < CONFIG.GRID.size; col++) {
                line.push(row * CONFIG.GRID.size + col);
            }
            lines.push(line);
        }

        // Columns
        for (let col = 0; col < CONFIG.GRID.size; col++) {
            const line = [];
            for (let row = 0; row < CONFIG.GRID.size; row++) {
                line.push(row * CONFIG.GRID.size + col);
            }
            lines.push(line);
        }

        // Diagonals
        const diagonal1 = [];
        const diagonal2 = [];
        for (let i = 0; i < CONFIG.GRID.size; i++) {
            diagonal1.push(i * CONFIG.GRID.size + i);
            diagonal2.push(i * CONFIG.GRID.size + (CONFIG.GRID.size - 1 - i));
        }
        lines.push(diagonal1, diagonal2);

        return lines;
    }

    highlightBingoLine(line) {
        this.bingoLines.push(line);
        for (const index of line) {
            if (index >= 0 && index < this.cells.length) {
                this.cells[index].classList.add('bingo-line');
            }
        }
    }

    removeBingoHighlight() {
        for (const line of this.bingoLines) {
            for (const index of line) {
                if (index >= 0 && index < this.cells.length) {
                    this.cells[index].classList.remove('bingo-line');
                }
            }
        }
        this.bingoLines = [];
    }

    getCompletedCells() {
        return Array.from(this.completedCells);
    }

    reset() {
        this.completedCells.clear();
        this.bingoLines = [];

        for (const cell of this.cells) {
            cell.classList.remove('completed', 'bingo-line');
        }
    }
} 