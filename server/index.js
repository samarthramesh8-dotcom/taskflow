require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRouter = require('./auth');
const tasksRouter = require('./tasks');
const { authMiddleware } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration - strict in production
const corsOptions = {
  origin: NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Limit payload size

// Rate limiting middleware
const rateLimitStore = new Map();

function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const key = `${identifier}-${req.path}`;
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const record = rateLimitStore.get(key);
    
    if (now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter.toString());
      return res.status(429).json({ 
        error: 'Too many requests, please try again later',
        retryAfter 
      });
    }
    
    record.count++;
    next();
  };
}

// Cleanup rate limit store every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

// Public auth routes with rate limiting (5 requests per 15 minutes per IP)
app.use('/auth/register', rateLimit(15 * 60 * 1000, 5));
app.use('/auth/login', rateLimit(15 * 60 * 1000, 10));
app.use('/auth', authRouter);

// Protected task routes with rate limiting (100 requests per minute per user)
app.use('/api/tasks', authMiddleware, rateLimit(60 * 1000, 100), tasksRouter);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: NODE_ENV });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Auth:  http://localhost:${PORT}/auth/login`);
  console.log(`   Tasks: http://localhost:${PORT}/api/tasks`);
  if (NODE_ENV === 'production') {
    console.log('⚠️  Production mode: seed endpoint disabled');
  }
});