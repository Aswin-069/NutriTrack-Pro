import crypto from 'crypto';

const isProd = process.env.NODE_ENV === 'production';

// Global middleware to initialize CSRF token cookie on GET requests
export const setupCsrfCookie = (req, res, next) => {
  // Only set on safe requests (GET/HEAD)
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!req.cookies.csrfToken) {
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('csrfToken', csrfToken, {
        httpOnly: false, // Must be readable by client JS to send back as header
        secure: isProd,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
      // Also attach to req so controllers can read if needed
      req.csrfToken = csrfToken;
    } else {
      req.csrfToken = req.cookies.csrfToken;
    }
  }
  next();
};

// Middleware to verify CSRF token on unsafe requests (POST, PUT, DELETE)
export const verifyCsrf = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies.csrfToken;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn(`[SECURITY WARNING] CSRF token mismatch/missing on ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }

  next();
};
