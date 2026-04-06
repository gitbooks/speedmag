require('dotenv').config({ path: __dirname + '/../.env' });
const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const ideasRoutes = require('./routes/ideas');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json());

// Rate limiting for idea submissions
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many submissions. Try again later.' },
});

const upvoteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many upvotes. Slow down.' },
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ideas', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') {
    return submitLimiter(req, res, next);
  }
  if (req.method === 'POST' && req.path.endsWith('/upvote')) {
    return upvoteLimiter(req, res, next);
  }
  next();
}, ideasRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve static website files (index.html, roadmap.html, etc.)
app.use(express.static(path.join(__dirname, '..', '..')));

// Fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SpeedMag running on port ${PORT}`);
});
