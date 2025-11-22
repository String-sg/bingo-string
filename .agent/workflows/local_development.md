---
description: How to run the Bingo app locally
---

# Local Development Guide

Follow these steps to run the Bingo app locally with both frontend and backend.

## Prerequisites

- Node.js installed
- PostgreSQL database running (locally or cloud)
- Google OAuth Client ID

## 1. Setup Backend

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    - Copy `.env.example` to `.env`:
      ```bash
      cp .env.example .env
      ```
    - Edit `.env` and fill in your `DATABASE_URL` and `GOOGLE_CLIENT_ID`.

4.  Run database migrations:
    ```bash
    npx prisma generate
    npx prisma migrate dev
    ```

5.  Start the backend server:
    ```bash
    npm run dev
    ```
    The server will start on `http://localhost:3000`.

## 2. Setup Frontend

1.  Open a new terminal and navigate to the root directory.

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    - Copy `.env.example` to `.env`:
      ```bash
      cp .env.example .env
      ```
    - Edit `.env` and fill in `VITE_GOOGLE_CLIENT_ID` (same as backend).
    - Ensure `VITE_API_BASE_URL=/api` (Vite will proxy this to localhost:3000).

4.  Start the frontend server:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173`.

## 3. Verification

- Open `http://localhost:5173`.
- Try logging in with Google.
- Try creating a new game.
- Verify that the game is saved to your database.
