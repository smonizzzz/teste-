// src/middleware/errorHandler.js
// Central error handler — keeps every route clean.

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  // Log full error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.path} →`, err);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
