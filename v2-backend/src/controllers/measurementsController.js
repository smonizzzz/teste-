// src/controllers/measurementsController.js

const db = require('../db/connection');

// GET /measurements/:sessionId
// Returns all measurements for a session, parsed.
function getMeasurementsBySession(req, res, next) {
  try {
    const { sessionId } = req.params;

    // Verify session exists
    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }

    const measurements = db.prepare(`
      SELECT id, session_id, timestamp, joint_angles, is_correct
      FROM measurements
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `).all(sessionId).map(m => ({
      ...m,
      joint_angles: JSON.parse(m.joint_angles),
      is_correct: Boolean(m.is_correct)
    }));

    res.json(measurements);
  } catch (err) {
    next(err);
  }
}

// POST /measurements
// Called by S2 (sensor team) with raw joint data,
// and optionally by V1 with AI result attached.
//
// Body: {
//   sessionId,
//   jointAngles: { knee: 45.2, hip: 30.1, ... },
//   isCorrect: true | false,   (optional, from V1)
//   timestamp: "2026-03-26T10:01:05Z"  (optional, defaults to now)
// }
function createMeasurement(req, res, next) {
  try {
    const { sessionId, jointAngles, isCorrect = false, timestamp } = req.body;

    if (!sessionId || !jointAngles) {
      const err = new Error('sessionId and jointAngles are required');
      err.status = 400;
      return next(err);
    }

    if (typeof jointAngles !== 'object' || Array.isArray(jointAngles)) {
      const err = new Error('jointAngles must be a JSON object, e.g. { "knee": 45.2 }');
      err.status = 400;
      return next(err);
    }

    // Verify session exists and is still open
    const session = db.prepare('SELECT id, ended_at FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }
    if (session.ended_at) {
      const err = new Error('Cannot add measurements to a closed session');
      err.status = 409;
      return next(err);
    }

    const result = db.prepare(`
      INSERT INTO measurements (session_id, joint_angles, is_correct, timestamp)
      VALUES (?, ?, ?, COALESCE(?, datetime('now')))
    `).run(
      sessionId,
      JSON.stringify(jointAngles),
      isCorrect ? 1 : 0,
      timestamp || null
    );

    const created = db.prepare('SELECT * FROM measurements WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({
      ...created,
      joint_angles: JSON.parse(created.joint_angles),
      is_correct: Boolean(created.is_correct)
    });
  } catch (err) {
    next(err);
  }
}

// POST /measurements/batch
// Accepts an array of measurements in one request.
// Useful for S2 when buffering sensor frames.
// Body: { sessionId, measurements: [ { jointAngles, isCorrect, timestamp }, ... ] }
function createMeasurementsBatch(req, res, next) {
  try {
    const { sessionId, measurements } = req.body;

    if (!sessionId || !Array.isArray(measurements) || measurements.length === 0) {
      const err = new Error('sessionId and a non-empty measurements array are required');
      err.status = 400;
      return next(err);
    }

    const session = db.prepare('SELECT id, ended_at FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }
    if (session.ended_at) {
      const err = new Error('Cannot add measurements to a closed session');
      err.status = 409;
      return next(err);
    }

    const insert = db.prepare(`
      INSERT INTO measurements (session_id, joint_angles, is_correct, timestamp)
      VALUES (?, ?, ?, COALESCE(?, datetime('now')))
    `);

    // Wrap in a transaction for atomicity and performance
    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(
          sessionId,
          JSON.stringify(row.jointAngles),
          row.isCorrect ? 1 : 0,
          row.timestamp || null
        );
      }
    });

    insertMany(measurements);

    res.status(201).json({ inserted: measurements.length, sessionId });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMeasurementsBySession,
  createMeasurement,
  createMeasurementsBatch
};
