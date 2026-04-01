# V2 Backend — API & Storage
**DSD 2025–2026 · UTAD × Jilin University**

Team V2 · Node.js + Express + SQLite

---

## Folder Structure

```
v2-backend/
├── data/
│   └── v2.db                         ← SQLite database (auto-created)
├── src/
│   ├── server.js                     ← Entry point
│   ├── db/
│   │   ├── connection.js             ← Single DB connection
│   │   └── init.js                   ← Creates all tables (run once)
│   ├── middleware/
│   │   └── errorHandler.js           ← Central error handler
│   ├── routes/
│   │   ├── users.js
│   │   ├── sessions.js
│   │   ├── measurements.js
│   │   └── recommendations.js
│   └── controllers/
│       ├── usersController.js
│       ├── sessionsController.js
│       ├── measurementsController.js
│       └── recommendationsController.js
├── package.json
└── README.md
```

---

## Setup (Step by Step)

### 1 — Prerequisites
- Node.js v18 or higher
- npm

### 2 — Install dependencies
```bash
npm install
```

### 3 — Initialise the database
Run this once to create all tables:
```bash
npm run init-db
```
This creates `data/v2.db` automatically.

### 4 — Start the server
```bash
# Production
npm start

# Development (auto-restarts on file change)
npm run dev
```

Server runs at: **http://localhost:3000**

### 5 — Verify it works
```bash
curl http://localhost:3000/health
```
Expected response:
```json
{
  "status": "ok",
  "team": "V2 - Backend API & Storage",
  "project": "DSD 2025-2026",
  "timestamp": "2026-03-26T10:00:00.000Z"
}
```

---

## Database Schema

```sql
users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'patient',   -- 'patient' | 'clinician'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)

sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at   TEXT            -- NULL while session is active
)

measurements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER NOT NULL REFERENCES sessions(id),
  timestamp    TEXT NOT NULL DEFAULT (datetime('now')),
  joint_angles TEXT NOT NULL,   -- JSON string: { "knee": 45.2, "hip": 30.1 }
  is_correct   INTEGER NOT NULL DEFAULT 0   -- 0 | 1
)

recommendations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES sessions(id),
  movement    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'accepted' | 'rejected'
  confidence  REAL NOT NULL DEFAULT 0.0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
```

---

## API Reference

### Health
```
GET /health
```

---

### Users

#### List all users
```
GET /users
```
Response:
```json
[
  { "id": 1, "name": "Ana Costa", "email": "ana@utad.pt", "role": "patient", "created_at": "2026-03-26T10:00:00" }
]
```

#### Get single user
```
GET /users/:id
```
Response includes `session_count`.

#### Create user
```
POST /users
Content-Type: application/json

{
  "name": "Ana Costa",
  "email": "ana@utad.pt",
  "role": "patient"
}
```
- `role` is optional, defaults to `"patient"`
- Valid roles: `"patient"`, `"clinician"`

---

### Sessions

#### List sessions
```
GET /sessions
GET /sessions?userId=1        ← filter by user
```

#### Get session detail
```
GET /sessions/:id
```
Response includes full measurements array.

#### Create session
```
POST /sessions
Content-Type: application/json

{ "userId": 1 }
```

#### Close session
```
PATCH /sessions/:id/end
```
Sets `ended_at` to current timestamp.

---

### Measurements

#### Get measurements for a session
```
GET /measurements/:sessionId
```
Response:
```json
[
  {
    "id": 1,
    "session_id": 1,
    "timestamp": "2026-03-26T10:01:05",
    "joint_angles": { "knee": 45.2, "hip": 30.1 },
    "is_correct": true
  }
]
```

#### Post a single measurement (from S2 / V1)
```
POST /measurements
Content-Type: application/json

{
  "sessionId": 1,
  "jointAngles": { "knee": 45.2, "hip": 30.1 },
  "isCorrect": true,
  "timestamp": "2026-03-26T10:01:05Z"
}
```
- `isCorrect` and `timestamp` are optional
- Session must be open (not ended)

#### Post a batch of measurements
```
POST /measurements/batch
Content-Type: application/json

{
  "sessionId": 1,
  "measurements": [
    { "jointAngles": { "knee": 42.1 }, "isCorrect": false },
    { "jointAngles": { "knee": 44.8 }, "isCorrect": true  },
    { "jointAngles": { "knee": 45.2 }, "isCorrect": true  }
  ]
}
```
All rows inserted in a single transaction.

---

### Recommendations

#### Get recommendations for a session
```
GET /recommendations/session/:sessionId
```

#### Run recommendation engine for a user
```
GET /recommendations/engine/:userId
```
Analyses the last 10 sessions and returns exercise suggestions ranked by priority.

Response:
```json
{
  "userId": 1,
  "based_on_sessions": 3,
  "generated_at": "2026-03-26T10:05:00.000Z",
  "suggestions": [
    {
      "movement": "knee_extension",
      "accuracy": 0.58,
      "total_attempts": 12,
      "suggestion": "Needs improvement (58% correct)",
      "priority": "medium"
    }
  ]
}
```

#### Create a recommendation (from AI / engine)
```
POST /recommendations
Content-Type: application/json

{
  "sessionId": 1,
  "movement": "knee_extension",
  "confidence": 0.92,
  "status": "pending"
}
```

#### Update recommendation status
```
PATCH /recommendations/:id
Content-Type: application/json

{ "status": "accepted" }
```
Valid statuses: `"pending"`, `"accepted"`, `"rejected"`

---

## Quick Test Flow

```bash
# 1. Create a patient
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Costa","email":"ana@utad.pt","role":"patient"}' | json_pp

# 2. Start a session
curl -s -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId":1}' | json_pp

# 3. Post a measurement
curl -s -X POST http://localhost:3000/measurements \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1,"jointAngles":{"knee":45.2,"hip":30.1},"isCorrect":true}' | json_pp

# 4. Get session detail
curl -s http://localhost:3000/sessions/1 | json_pp

# 5. Close session
curl -s -X PATCH http://localhost:3000/sessions/1/end | json_pp

# 6. Get recommendations
curl -s http://localhost:3000/recommendations/engine/1 | json_pp
```

---

## Integration Notes for Other Teams

| Team | How they interact with V2 |
|------|--------------------------|
| **S2** | `POST /measurements` or `POST /measurements/batch` — send sensor frames |
| **V1** | `POST /measurements` with `isCorrect` field from AI model |
| **M1** | `GET /sessions?userId=X`, `GET /measurements/:sessionId`, `GET /recommendations/engine/:userId` |
| **M2** | `GET /sessions`, `GET /sessions/:id`, `GET /recommendations/session/:id` |

---

## Environment Variables

Create a `.env` file (optional — defaults shown):
```
PORT=3000
NODE_ENV=development
```
