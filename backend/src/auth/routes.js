import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import emailService from './emailService.js';

const router = express.Router();

// Rate limiting for OTP requests
const otpLimiter = rateLimit({
    windowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
    max: parseInt(process.env.OTP_RATE_LIMIT_MAX) || 3,
    message: {
        error: 'Too many OTP requests. Please try again later.'
    },
    keyGenerator: (req) => req.body.email || req.ip
});

// Validation middleware
const validateEmail = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
];

const validateOTP = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('otp')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('OTP must be a 6-digit number')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed');
        error.type = 'validation';
        error.details = errors.array();
        return next(error);
    }
    next();
};

// Generate JWT token
const generateToken = (email) => {
    return jwt.sign(
        {
            email,
            type: 'instance_creator',
            iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// POST /api/auth/request-otp
router.post('/request-otp', otpLimiter, validateEmail, handleValidationErrors, async (req, res, next) => {
    try {
        const { email } = req.body;

        console.log(`📧 OTP request from: ${email}`);

        await emailService.sendOTP(email, 'instance_creation');

        res.json({
            success: true,
            message: 'Verification code sent to your email',
            email: email.replace(/(.{2}).*(@.*)/, '$1***$2') // Partially hide email
        });

    } catch (error) {
        console.error('OTP request error:', error);

        if (error.message.includes('not authorized')) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Your email is not authorized to create instances. Please contact an administrator.'
            });
        }

        if (error.message.includes('not configured')) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Email service is not configured. Please contact support.'
            });
        }

        next(error);
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', validateOTP, handleValidationErrors, async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        console.log(`🔐 OTP verification attempt for: ${email}`);

        // Verify the OTP
        emailService.verifyOTP(email, otp);

        // Generate access token
        const token = generateToken(email);

        res.json({
            success: true,
            message: 'Email verified successfully',
            token,
            user: {
                email,
                verified: true,
                permissions: ['create_instances']
            }
        });

        console.log(`✅ OTP verified for: ${email}`);

    } catch (error) {
        console.error('OTP verification error:', error);

        if (error.message.includes('expired')) {
            return res.status(400).json({
                error: 'OTP expired',
                message: 'Your verification code has expired. Please request a new one.'
            });
        }

        if (error.message.includes('Invalid OTP') || error.message.includes('No OTP found')) {
            return res.status(400).json({
                error: 'Invalid code',
                message: 'The verification code is incorrect. Please try again.'
            });
        }

        if (error.message.includes('Too many failed attempts')) {
            return res.status(429).json({
                error: 'Too many attempts',
                message: 'Too many failed attempts. Please request a new code.'
            });
        }

        next(error);
    }
});

// Middleware to verify JWT token
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Access denied',
            message: 'No authentication token provided'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please verify your email again.'
            });
        }

        return res.status(401).json({
            error: 'Invalid token',
            message: 'Invalid authentication token'
        });
    }
};

// GET /api/auth/verify-token
router.get('/verify-token', verifyToken, (req, res) => {
    res.json({
        success: true,
        user: {
            email: req.user.email,
            verified: true,
            permissions: ['create_instances']
        }
    });
});

// POST /api/auth/logout
router.post('/logout', verifyToken, (req, res) => {
    // With JWT, logout is handled client-side by removing the token
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// GET /api/auth/whitelist-check
router.get('/whitelist-check', (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({
            error: 'Email required',
            message: 'Please provide an email address to check'
        });
    }

    const whitelist = process.env.ADMIN_WHITELIST?.split(',') || [];
    const isWhitelisted = whitelist.includes(email);

    res.json({
        email,
        whitelisted: isWhitelisted
    });
});

export default router;