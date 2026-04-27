require('dotenv').config()
const { DatabaseSync } = require('node:sqlite')   // built-in Node.js 22+
const bcrypt = require('bcryptjs')
const path   = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'optimind.db')
const db = new DatabaseSync(DB_PATH)

// Performance settings
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA foreign_keys = ON")

// ─── Schema ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    full_name     TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'developer',
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login    TEXT
  );

  CREATE TABLE IF NOT EXISTS security_questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    question    TEXT    NOT NULL,
    answer_hash TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    client      TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'Pendiente',
    priority    TEXT    NOT NULL DEFAULT 'Media',
    budget      REAL    NOT NULL DEFAULT 0,
    deadline    TEXT,
    progress    INTEGER NOT NULL DEFAULT 0,
    tags        TEXT    NOT NULL DEFAULT '[]',
    description TEXT,
    created_by  INTEGER,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    goal       TEXT,
    start_date TEXT,
    end_date   TEXT,
    status     TEXT    NOT NULL DEFAULT 'planning',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    project      TEXT,
    project_id   INTEGER,
    sprint_id    INTEGER,
    assignee     TEXT,
    status       TEXT    NOT NULL DEFAULT 'Backlog',
    priority     TEXT    NOT NULL DEFAULT 'Media',
    type         TEXT    NOT NULL DEFAULT 'task',
    story_points INTEGER NOT NULL DEFAULT 1,
    due          TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (sprint_id)  REFERENCES sprints(id)  ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    contact    TEXT,
    email      TEXT,
    sector     TEXT    NOT NULL DEFAULT 'Otro',
    status     TEXT    NOT NULL DEFAULT 'Prospecto',
    value      REAL    NOT NULL DEFAULT 0,
    projects   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Migrations (safe – ignore if column already exists) ──────────────────
;[
  "ALTER TABLE tasks ADD COLUMN description  TEXT",
  "ALTER TABLE tasks ADD COLUMN project_id   INTEGER",
  "ALTER TABLE tasks ADD COLUMN sprint_id    INTEGER",
  "ALTER TABLE tasks ADD COLUMN type         TEXT NOT NULL DEFAULT 'task'",
  "ALTER TABLE tasks ADD COLUMN story_points INTEGER NOT NULL DEFAULT 1",
].forEach(sql => { try { db.exec(sql) } catch (_) {} })

// Migrate old status values to new Scrum statuses
db.exec(`UPDATE tasks SET status = 'Backlog'      WHERE status = 'Pendiente'`)
db.exec(`UPDATE tasks SET status = 'En Progreso'  WHERE status = 'En progreso'`)
db.exec(`UPDATE tasks SET status = 'Completada'   WHERE status = 'Completado'`)

// ─── Seed ──────────────────────────────────────────────────────────────────
const count = db.prepare('SELECT COUNT(*) as n FROM users').get()
if (count.n === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (username, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  )
  const insertQ = db.prepare(
    'INSERT INTO security_questions (user_id, question, answer_hash) VALUES (?, ?, ?)'
  )

  const adminId = insertUser.run(
    'admin', 'Administrador', 'admin@optimind.co', bcrypt.hashSync('Optimind2025!', 10), 'admin'
  ).lastInsertRowid
  insertQ.run(adminId, '¿Cuál es el nombre del fundador de OptiMind?', bcrypt.hashSync('wernher', 10))
  insertQ.run(adminId, '¿En qué año se fundó OptiMind Solutions?',     bcrypt.hashSync('2025', 10))

  const wernherId = insertUser.run(
    'wernher', 'Wernher Florez', 'florezwernher26@gmail.com', bcrypt.hashSync('Wernher2025!', 10), 'admin'
  ).lastInsertRowid
  insertQ.run(wernherId, '¿Cuál es tu meta profesional?', bcrypt.hashSync('dba', 10))
  insertQ.run(wernherId, '¿En qué universidad estudias?', bcrypt.hashSync('cun', 10))

  const kevinId = insertUser.run(
    'kevin', 'Kevin Gonzalez', 'kevin@optimind.co', bcrypt.hashSync('Kevin2025!', 10), 'developer'
  ).lastInsertRowid
  insertQ.run(kevinId, '¿Cuál es tu tecnología favorita?', bcrypt.hashSync('react', 10))

  console.log('✅ Base de datos iniciada')
  console.log('   admin    / Optimind2025!')
  console.log('   wernher  / Wernher2025!')
  console.log('   kevin    / Kevin2025!')
}

module.exports = db
