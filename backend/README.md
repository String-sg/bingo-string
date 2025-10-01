# Bingo Backend API

Express.js backend for the String Bingo application with PostgreSQL/NeonDB and Prisma ORM.

## Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and configure:
```env
DATABASE_URL="your_neondb_connection_string"
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
PORT=3000
NODE_ENV=development
CORS_ORIGINS="http://localhost:5173,https://string.sg"
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Development
```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with Google token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout (analytics)

### Games
- `GET /api/games` - Get user's games (auth required)
- `POST /api/games` - Create new game (auth required)
- `GET /api/games/:id` - Get specific game (public or owner)
- `PUT /api/games/:id` - Update game (owner only)
- `DELETE /api/games/:id` - Delete game (owner only)
- `GET /api/games/:id/play` - Get game for playing (public)

### Health Check
- `GET /health` - Server health status

## Database Schema

### Users
- `id` - Unique identifier
- `email` - User email (unique)
- `name` - Display name
- `picture` - Profile picture URL
- `googleId` - Google OAuth user ID
- `createdAt`, `updatedAt` - Timestamps

### Games
- `id` - Unique identifier
- `name` - Game name
- `creatorEmail` - Creator's email
- `challengesJson` - Array of 25 challenges (JSON)
- `isPublic` - Whether game is publicly accessible
- `createdAt`, `updatedAt` - Timestamps

### GameSessions
- `id` - Unique identifier
- `gameId` - Reference to game
- `userEmail` - Player's email
- `progressJson` - Game progress data (JSON)
- `completedAt` - Completion timestamp
- `createdAt`, `updatedAt` - Timestamps

## Security Features

- Google OAuth JWT validation
- CORS protection
- Helmet security headers
- Request rate limiting
- Input validation
- SQL injection protection (Prisma)

## Deployment

This backend can be deployed to:
- Railway
- Render
- Vercel (serverless functions)
- Heroku
- Any Node.js hosting platform

Make sure to:
1. Set all environment variables
2. Run database migrations
3. Configure CORS origins for your frontend domain