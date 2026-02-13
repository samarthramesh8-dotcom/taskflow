require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const authRouter = require('./auth');
const tasksRouter = require('./tasks');
const { authMiddleware } = require('./auth');
const { query } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('[Server] Starting...', { PORT, NODE_ENV, hasDbUrl: !!process.env.DATABASE_URL });

// CORS configuration
const allowedOrigins = NODE_ENV === 'production' 
  ? (process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
      'https://your-app.vercel.app'
    ])
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];

console.log('[Server] Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked: ${origin}`);
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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
      console.warn(`[RateLimit] ${key} exceeded`);
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter 
      });
    }
    
    record.count++;
    next();
  };
}

// Cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

// Health check - MUST be first
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(), 
      env: NODE_ENV,
      port: PORT,
      database: 'connected'
    });
  } catch (err) {
    console.error('[Health] Database connection failed:', err.message);
    res.status(503).json({ 
      status: 'error', 
      message: 'Database connection failed',
      database: 'disconnected'
    });
  }
});

const runMigrations = async () => {
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ`);
};

const startServer = () => {
  // Auth routes - MUST be registered
  console.log('[Server] Registering /auth routes');
  app.use('/auth', authRouter);

  // Task routes
  console.log('[Server] Registering /api/tasks routes');
  app.use('/api/tasks', authMiddleware, tasksRouter);

  // 404 handler - MUST return JSON
  app.use((req, res) => {
    console.warn(`[404] ${req.method} ${req.path}`);
    res.status(404).json({ 
      error: 'Not found',
      path: req.path
    });
  });

  // CORS error handler - MUST return JSON
  app.use((err, req, res, next) => {
    if (err.message === 'CORS policy violation') {
      console.warn('[CORS] Policy violation from:', req.get('origin'));
      return res.status(403).json({ 
        error: 'CORS policy violation',
        origin: req.get('origin')
      });
    }
    next(err);
  });

  // Global error handler - MUST return JSON
  app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    res.status(err.status || 500).json({ 
      error: err.message || 'Internal server error',
      ...(NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Database: ${process.env.DATABASE_URL ? 'configured' : 'MISSING'}`);
    console.log(`   Routes: /health, /auth/*, /api/tasks/*`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, closing server...');
    server.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });
};

runMigrations()
  .then(startServer)
  .catch((err) => {
    console.error('[Migration] Failed to apply startup migrations:', err);
    process.exit(1);
  });