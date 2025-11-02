import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import route handlers
import authRoutes from './auth/routes.js';
import instanceRoutes from './instances/routes.js';
import githubRoutes from './github/routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5174'];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/github', githubRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    if (err.type === 'validation') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.details
        });
    }

    if (err.type === 'auth') {
        return res.status(401).json({
            error: 'Authentication failed',
            message: err.message
        });
    }

    if (err.type === 'github') {
        return res.status(500).json({
            error: 'GitHub API error',
            message: err.message
        });
    }

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested endpoint does not exist'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Bingo Backend Server running on port ${PORT}`);
    console.log(`📧 Email OTP: ${process.env.SMTP_USER ? 'Configured' : 'Not configured'}`);
    console.log(`🐙 GitHub API: ${process.env.GITHUB_TOKEN ? 'Configured' : 'Not configured'}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
});