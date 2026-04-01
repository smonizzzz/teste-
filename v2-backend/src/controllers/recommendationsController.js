// src/controllers/recommendationsController.js

const db = require('../db/connection');

// GET /recommendations/:sessionId
// Returns all recommendations generated for a session.
function getRecommendationsBySession(req, res, next) {
  try {
    const { sessionId } = req.params;

    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }

    const recommendations = db.prepare(`
      SELECT id, session_id, movement, status, confidence, created_at
      FROM recommendations
      WHERE session_id = ?
      ORDER BY confidence DESC
    `).all(sessionId);

    res.json(recommendations);
  } catch (err) {
    next(err);
  }
}

// POST /recommendations
// Called internally by the recommendation engine,
// or by V1 after AI analysis.
//
// Body: {
//   sessionId,
//   movement: "knee_extension",
//   confidence: 0.92,
//   status?: "pending"
// }
function createRecommendation(req, res, next) {
  try {
    const { sessionId, movement, confidence = 0.0, status = 'pending' } = req.body;

    if (!sessionId || !movement) {
      const err = new Error('sessionId and movement are required');
      err.status = 400;
      return next(err);
    }

    const validStatuses = ['pending', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`status must be one of: ${validStatuses.join(', ')}`);
      err.status = 400;
      return next(err);
    }

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      const err = new Error('confidence must be a number between 0 and 1');
      err.status = 400;
      return next(err);
    }

    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }

    const result = db.prepare(`
      INSERT INTO recommendations (session_id, movement, status, confidence)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, movement, status, confidence);

    const created = db.prepare('SELECT * FROM recommendations WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// PATCH /recommendations/:id
// Update the status of a recommendation (accepted / rejected).
// Body: { status }
function updateRecommendationStatus(req, res, next) {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'rejected'];

    if (!status || !validStatuses.includes(status)) {
      const err = new Error(`status must be one of: ${validStatuses.join(', ')}`);
      err.status = 400;
      return next(err);
    }

    const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(req.params.id);
    if (!rec) {
      const err = new Error('Recommendation not found');
      err.status = 404;
      return next(err);
    }

    db.prepare('UPDATE recommendations SET status = ? WHERE id = ?')
      .run(status, req.params.id);

    const updated = db.prepare('SELECT * FROM recommendations WHERE id = ?')
      .get(req.params.id);

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /recommendations/engine/:userId
// Recommendation engine: analyses historical sessions
// and returns suggested exercises for the user.
function generateRecommendations(req, res, next) {
  try {
    const { userId } = req.params;

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      return next(err);
    }

    // Analyse accuracy per movement across last 10 sessions
    const stats = db.prepare(`
      SELECT
        json_extract(m.joint_angles, '$.movement') AS movement,
        COUNT(*) AS total,
        SUM(m.is_correct) AS correct,
        ROUND(CAST(SUM(m.is_correct) AS FLOAT) / COUNT(*), 2) AS accuracy
      FROM measurements m
      JOIN sessions s ON s.id = m.session_id
      WHERE s.user_id = ?
        AND s.id IN (
          SELECT id FROM sessions WHERE user_id = ?
          ORDER BY started_at DESC LIMIT 10
        )
      GROUP BY movement
      HAVING movement IS NOT NULL
      ORDER BY accuracy ASC
    `).all(userId, userId);

    // Build suggestions: flag movements below 70% accuracy
    const suggestions = stats.map(s => ({
      movement: s.movement,
      accuracy: s.accuracy,
      total_attempts: s.total,
      suggestion: s.accuracy < 0.7
        ? `Needs improvement (${Math.round(s.accuracy * 100)}% correct)`
        : `Good performance (${Math.round(s.accuracy * 100)}% correct)`,
      priority: s.accuracy < 0.5 ? 'high' : s.accuracy < 0.7 ? 'medium' : 'low'
    }));

    res.json({
      userId,
      based_on_sessions: Math.min(stats.length > 0 ? 10 : 0, 10),
      generated_at: new Date().toISOString(),
      suggestions
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRecommendationsBySession,
  createRecommendation,
  updateRecommendationStatus,
  generateRecommendations
};
