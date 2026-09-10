const rateLimit = require('express-rate-limit');

// 1. Strict Limiter for Authentication (stops brute-force & bcrypt CPU exhaustion)
// Allows up to 15 attempts per 15-minute window per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts from this device. Please try again after 15 minutes.'
  }
});

// 2. Financial Limiter for Sensitive Vault Mutations (payouts, deposits, withdrawals)
// Allows up to 20 mutations per 1-minute window per IP to prevent accidental multi-clicks or race conditions
const financialLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Transaction rate limit reached. Please wait a moment before submitting again.'
  }
});

// 3. General Limiter for API Endpoints
// Protects database query bandwidth (300 requests per 15 minutes)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'API request limit exceeded. Please slow down.'
  }
});

module.exports = {
  authLimiter,
  financialLimiter,
  generalApiLimiter
};
