// src/controllers/usersController.js

const db = require('../db/connection');

// GET /users
// Returns all users ordered by creation date.
function getUsers(req, res, next) {
  try {
    const users = db.prepare(`
      SELECT id, name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json(users);
  } catch (err) {
    next(err);
  }
}

// GET /users/:id
// Returns a single user plus their session count.
function getUserById(req, res, next) {
  try {
    const user = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.created_at,
             COUNT(s.id) AS session_count
      FROM users u
      LEFT JOIN sessions s ON s.user_id = u.id
      WHERE u.id = ?
      GROUP BY u.id
    `).get(req.params.id);

    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      return next(err);
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
}

// POST /users
// Body: { name, email, role? }
function createUser(req, res, next) {
  try {
    const { name, email, role = 'patient' } = req.body;

    if (!name || !email) {
      const err = new Error('name and email are required');
      err.status = 400;
      return next(err);
    }

    const validRoles = ['patient', 'clinician'];
    if (!validRoles.includes(role)) {
      const err = new Error(`role must be one of: ${validRoles.join(', ')}`);
      err.status = 400;
      return next(err);
    }

    const result = db.prepare(`
      INSERT INTO users (name, email, role)
      VALUES (?, ?, ?)
    `).run(name, email, role);

    const created = db.prepare('SELECT * FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) {
    // SQLite UNIQUE constraint violation
    if (err.message && err.message.includes('UNIQUE')) {
      err.status = 409;
      err.message = 'A user with that email already exists';
    }
    next(err);
  }
}

module.exports = { getUsers, getUserById, createUser };
