require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');
const { generalApiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Trust Render's reverse proxy for accurate client IP resolution in rate limiting
app.set('trust proxy', 1);

// Security HTTP headers
app.use(helmet());

// Production CORS: allows local dev, any preview/production Vercel domain, and optional custom FRONTEND_URL
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Apply general rate limiter to team API routes
app.use('/team', generalApiLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/team', teamRoutes);

// Server health check for keep-alive pings (e.g. UptimeRobot / CronJob)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Rosterly Backend API', version: '1.0.0' });
});

// 404 Catch-All for unknown API routes
app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global Fallback Error Handler Middleware
// Catches unhandled pipeline errors, malformed JSON body errors, and unexpected exceptions
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error'
  });
});

// MongoDB connection with connection pool limit for Atlas free-tier safety
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
  })
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('Warning: MONGODB_URI environment variable is not defined.');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
