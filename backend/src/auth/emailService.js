import nodemailer from 'nodemailer';
import crypto from 'crypto';

class EmailService {
    constructor() {
        this.transporter = null;
        this.otpStore = new Map(); // In production, use Redis or database
        this.setupTransporter();
    }

    setupTransporter() {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('⚠️ SMTP credentials not configured');
            return;
        }

        this.transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Verify connection
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('❌ SMTP connection failed:', error);
            } else {
                console.log('✅ SMTP server is ready to send emails');
            }
        });
    }

    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    async sendOTP(email, purpose = 'verification') {
        if (!this.transporter) {
            throw new Error('Email service not configured');
        }

        // Check if email is whitelisted
        const whitelist = process.env.ADMIN_WHITELIST?.split(',') || [];
        if (!whitelist.includes(email)) {
            throw new Error('Email not authorized for instance creation');
        }

        const otp = this.generateOTP();
        const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

        // Store OTP (in production, use Redis with TTL)
        this.otpStore.set(email, {
            otp,
            expiresAt,
            purpose,
            attempts: 0
        });

        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: '🎯 Your Bingo Instance Creation Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 2rem;">🎯 Bingo Creator</h1>
                        <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">Create your custom bingo instance</p>
                    </div>

                    <div style="background: white; padding: 2rem; border: 1px solid #dee2e6; border-top: none;">
                        <h2 style="color: #333; margin-top: 0;">Your verification code is:</h2>

                        <div style="background: #f8f9fa; border: 2px dashed #007bff; border-radius: 8px; padding: 2rem; text-align: center; margin: 2rem 0;">
                            <div style="font-size: 3rem; font-weight: bold; color: #007bff; letter-spacing: 0.5rem; font-family: 'Courier New', monospace;">
                                ${otp}
                            </div>
                        </div>

                        <p style="color: #666; line-height: 1.6;">
                            Enter this code in the admin interface to verify your email and create a new bingo instance.
                        </p>

                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 1rem; margin: 1.5rem 0;">
                            <p style="margin: 0; color: #856404;">
                                <strong>⏱️ This code expires in 10 minutes</strong><br>
                                If you didn't request this code, please ignore this email.
                            </p>
                        </div>

                        <p style="color: #888; font-size: 0.9rem; margin-bottom: 0;">
                            Need help? Contact support or visit our documentation.
                        </p>
                    </div>

                    <div style="background: #f8f9fa; padding: 1rem; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #dee2e6; border-top: none;">
                        <p style="margin: 0; color: #666; font-size: 0.8rem;">
                            Made with ❤️ by String Team | Powered by Bingo Creator
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`📧 OTP sent to ${email}: ${otp}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send OTP email:', error);
            throw new Error('Failed to send verification email');
        }
    }

    verifyOTP(email, providedOTP) {
        const stored = this.otpStore.get(email);

        if (!stored) {
            throw new Error('No OTP found for this email');
        }

        if (Date.now() > stored.expiresAt) {
            this.otpStore.delete(email);
            throw new Error('OTP has expired');
        }

        if (stored.attempts >= 3) {
            this.otpStore.delete(email);
            throw new Error('Too many failed attempts');
        }

        if (stored.otp !== providedOTP) {
            stored.attempts++;
            throw new Error('Invalid OTP');
        }

        // OTP verified successfully
        this.otpStore.delete(email);
        return true;
    }

    cleanupExpiredOTPs() {
        const now = Date.now();
        for (const [email, data] of this.otpStore.entries()) {
            if (now > data.expiresAt) {
                this.otpStore.delete(email);
            }
        }
    }
}

// Cleanup expired OTPs every 5 minutes
const emailService = new EmailService();
setInterval(() => emailService.cleanupExpiredOTPs(), 5 * 60 * 1000);

export default emailService;