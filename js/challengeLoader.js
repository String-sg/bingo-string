import { CONFIG } from './config.js';

export class ChallengeLoader {
    constructor() {
        this.challenges = [];
    }

    async loadChallenges() {
        try {
            const response = await fetch(CONFIG.CHALLENGE_FILE);
            if (!response.ok) {
                throw new Error(`Failed to load challenges: ${response.status}`);
            }

            const csvText = await response.text();
            this.challenges = this.parseCSV(csvText);

            // Ensure we have exactly 25 challenges for a 5x5 grid
            if (this.challenges.length !== 25) {
                console.warn(`Expected 25 challenges, got ${this.challenges.length}`);
            }

            return this.challenges;
        } catch (error) {
            console.error('Error loading challenges:', error);
            throw error;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const challenges = [];

        // Skip header row
        const startIndex = 1;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                // Handle CSV with quotes and commas
                const challenge = this.parseCSVLine(line);
                if (challenge) {
                    challenges.push(challenge);
                }
            }
        }

        return challenges;
    }

    parseCSVLine(line) {
        // Handle CSV with quotes - split by comma but respect quoted fields
        const parts = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Add the last part
        parts.push(current.trim());

        if (parts.length >= 2) {
            return {
                id: parts[0],
                text: parts[1]
            };
        }
        return null;
    }

    getChallenge(index) {
        if (index >= 0 && index < this.challenges.length) {
            return this.challenges[index];
        }
        return null;
    }

    getAllChallenges() {
        return this.challenges;
    }
} 