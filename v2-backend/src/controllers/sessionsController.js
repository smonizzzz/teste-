// src/controllers/sessionsController.js

const db = require('../db/connection');

// GET /sessions
// Optional query param: ?userId=X to filter by user.
function getSessions(req, res, next) {
  try {
    const { userId } = req.query;

    let query = `
      SELECT s.id, s.user_id, s.started_at, s.ended_at,
             u.name AS user_name,
             COUNT(m.id) AS measurement_count
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN measurements m ON m.session_id = s.id
    `;
    const params = [];

    if (userId) {
      query += ' WHERE s.user_id = ?';
      params.push(userId);
    }

    query += ' GROUP BY s.id ORDER BY s.started_at DESC';

    const sessions = db.prepare(query).all(...params);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
}

// GET /sessions/:id
// Returns session detail including all measurements.
function getSessionById(req, res, next) {
  try {
    const session = db.prepare(`
      SELECT s.*, u.name AS user_name, u.email AS user_email
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }

    // Attach measurements and parse joint_angles JSON
    const measurements = db.prepare(`
      SELECT id, timestamp, joint_angles, is_correct
      FROM measurements
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `).all(req.params.id).map(m => ({
      ...m,
      joint_angles: JSON.parse(m.joint_angles),
      is_correct: Boolean(m.is_correct)
    }));

    res.json({ ...session, measurements });
  } catch (err) {
    next(err);
  }
}

// POST /sessions
// Body: { userId }
function createSession(req, res, next) {
  try {
    const { userId } = req.body;

    if (!userId) {
      const err = new Error('userId is required');
      err.status = 400;
      return next(err);
    }

    // Verify user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      return next(err);
    }

    const result = db.prepare(`
      INSERT INTO sessions (user_id) VALUES (?)
    `).run(userId);

    const created = db.prepare(`
      SELECT s.*, u.name AS user_name
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// PATCH /sessions/:id/end
// Closes an active session by setting ended_at.
function endSession(req, res, next) {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?')
      .get(req.params.id);

    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }

    if (session.ended_at) {
      const err = new Error('Session is already closed');
      err.status = 409;
      return next(err);
    }

    db.prepare(`
      UPDATE sessions SET ended_at = datetime('now') WHERE id = ?
    `).run(req.params.id);

    const updated = db.prepare('SELECT * FROM sessions WHERE id = ?')
      .get(req.params.id);

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSessions, getSessionById, createSession, endSession };
