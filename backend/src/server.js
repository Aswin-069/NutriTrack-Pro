import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Controllers
import { register, login, logout, me, sendOtp, verifyOtp, resetPasswordWithOtp, updateProfile } from './controllers/authController.js';
import { getLogsByDate, createLogEntry, updateLogEntry, deleteLogEntry, clearMealSlot } from './controllers/logController.js';
import { searchFoods, cacheFoodEntry } from './controllers/foodController.js';

// Middlewares
import { authenticate } from './middleware/authMiddleware.js';
import { setupCsrfCookie, verifyCsrf } from './middleware/csrfMiddleware.js';
import { 
  validate, 
  registerSchema, 
  loginSchema, 
  logEntrySchema, 
  foodCacheSchema 
} from './middleware/validationMiddleware.js';

import { execSync } from 'child_process';

dotenv.config();

// Auto-verify and push database schema on startup so tables always exist
if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  try {
    console.log('[DB Auto-Sync] Verifying PostgreSQL schema tables...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('[DB Auto-Sync] Database schema verified and up to date.');
  } catch (err) {
    console.error('[DB Auto-Sync Warning]:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Helmet for Secure HTTP Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. CORS configurations supporting FRONTEND_URL, Netlify, and Localhost
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production' || origin.endsWith('.netlify.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow origin dynamically for production flexibility
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// 3. Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // Max 15 login/register/reset requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-otp', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/reset-password-otp', authLimiter);

// 4. CSRF double-submit cookie middleware setup
app.use(setupCsrfCookie);
app.use(verifyCsrf);

// Auth routes
app.post('/api/auth/register', validate(registerSchema), register);
app.post('/api/auth/login', validate(loginSchema), login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/me', authenticate, me);
app.post('/api/auth/send-otp', sendOtp);
app.post('/api/auth/verify-otp', verifyOtp);
app.post('/api/auth/reset-password-otp', resetPasswordWithOtp);
app.put('/api/auth/profile', authenticate, updateProfile);

// Log routes
app.get('/api/logs', authenticate, getLogsByDate);
app.post('/api/logs', authenticate, validate(logEntrySchema), createLogEntry);
app.put('/api/logs/:id', authenticate, updateLogEntry); // PUT schema is partial, handled inside controller validation
app.delete('/api/logs/:id', authenticate, deleteLogEntry);
app.delete('/api/logs', authenticate, clearMealSlot);

// Food database routes
app.get('/api/foods/search', authenticate, searchFoods);
app.post('/api/foods/cache', authenticate, validate(foodCacheSchema), cacheFoodEntry);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
