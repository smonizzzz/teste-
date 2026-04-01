// src/db/connection.js
// Single SQLite connection shared across the whole app.
// better-sqlite3 is synchronous - no async/await needed for queries.

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/v2.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
