require('dotenv').config()
const { createClient } = require('@libsql/client')
const bcrypt = require('bcryptjs')

// ─── Client ────────────────────────────────────────────────────────────────
// Local dev:   TURSO_DATABASE_URL=file:./optimind.db  (no token needed)
// Production:  TURSO_DATABASE_URL=libsql://xxx.turso.io + TURSO_AUTH_TOKEN=...
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL || 'file:./optimind.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// ─── Helpers (drop-in replacement for node:sqlite sync API) ───────────────
async function get(sql, args = []) {
  const r = await db.execute({ sql, args })
  return r.rows[0] ?? null
}

async function all(sql, args = []) {
  const r = await db.execute({ sql, args })
  return r.rows
}

async function run(sql, args = []) {
  const r = await db.execute({ sql, args })
  return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.rowsAffected }
}

async function exec(sql) {
  // Batch each statement separately (Turso doesn't support multi-statement strings)
  const stmts = sql.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of stmts) {
    await db.execute(stmt)
  }
}

// ─── Schema ────────────────────────────────────────────────────────────────
async function createSchema() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      full_name     TEXT    NOT NULL,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'developer',
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      last_login    TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS security_questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      question    TEXT    NOT NULL,
      answer_hash TEXT    NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
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
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sprints (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      goal       TEXT,
      start_date TEXT,
      end_date   TEXT,
      status     TEXT    NOT NULL DEFAULT 'planning',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
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
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS clients (
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
    )`,
  ], 'write')
}

// ─── Seed ──────────────────────────────────────────────────────────────────
async function seed() {
  const count = await get('SELECT COUNT(*) as n FROM users')
  if (count.n > 0) return

  const insert = (u, fn, em, pw, role) =>
    run('INSERT INTO users (username,full_name,email,password_hash,role) VALUES (?,?,?,?,?)',
        [u, fn, em, bcrypt.hashSync(pw, 10), role])

  const insertQ = (uid, q, a) =>
    run('INSERT INTO security_questions (user_id,question,answer_hash) VALUES (?,?,?)',
        [uid, q, bcrypt.hashSync(a, 10)])

  const { lastInsertRowid: adminId }   = await insert('admin',   'Administrador',  'admin@optimind.co',           'Optimind2025!', 'admin')
  await insertQ(adminId,   '¿Cuál es el nombre del fundador de OptiMind?', 'wernher')
  await insertQ(adminId,   '¿En qué año se fundó OptiMind Solutions?',     '2025')

  const { lastInsertRowid: wernherId } = await insert('wernher', 'Wernher Florez', 'florezwernher26@gmail.com',   'Wernher2025!',  'admin')
  await insertQ(wernherId, '¿Cuál es tu meta profesional?', 'dba')
  await insertQ(wernherId, '¿En qué universidad estudias?', 'cun')

  const { lastInsertRowid: kevinId }   = await insert('kevin',   'Kevin Gonzalez', 'kevin@optimind.co',           'Kevin2025!',    'developer')
  await insertQ(kevinId,   '¿Cuál es tu tecnología favorita?', 'react')

  console.log('✅ Base de datos iniciada')
  console.log('   admin   / Optimind2025!')
  console.log('   wernher / Wernher2025!')
  console.log('   kevin   / Kevin2025!')
}

// ─── Init (called once at startup) ────────────────────────────────────────
async function init() {
  await createSchema()
  await seed()
}

module.exports = { db, get, all, run, exec, init }
