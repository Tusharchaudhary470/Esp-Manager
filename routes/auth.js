const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  changeUsername, 
  changePassword, 
  deleteAccount 
} = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// User Authentication (Rate-limited to prevent brute-force attacks)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Account & Profile Management
router.put('/change-username', authMiddleware, authLimiter, changeUsername);
router.put('/change-password', authMiddleware, authLimiter, changePassword);
router.delete('/account', authMiddleware, authLimiter, deleteAccount);

module.exports = router;
