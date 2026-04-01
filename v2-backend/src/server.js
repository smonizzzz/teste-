// src/server.js
// Entry point. Mounts all routes and starts the server.

const express = require('express');
const cors    = require('cors');

const errorHandler       = require('./middleware/errorHandler');
const usersRouter        = require('./routes/users');
const sessionsRouter     = require('./routes/sessions');
const measurementsRouter = require('./routes/measurements');
const recommendationsRouter = require('./routes/recommendations');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    team: 'V2 - Backend API & Storage',
    project: 'DSD 2025-2026',
    timestamp: new Date().toISOString()
  });
});

// ── API Routes ────────────────────────────────────────────
app.use('/users',           usersRouter);
app.use('/sessions',        sessionsRouter);
app.use('/measurements',    measurementsRouter);
app.use('/recommendations', recommendationsRouter);

// ── 404 handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Central error handler ─────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  V2 Backend running on http://localhost:${PORT}`);
  console.log(`   GET  http://localhost:${PORT}/health\n`);
});

module.exports = app;
