require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

// ─── Client ────────────────────────────────────────────────────────────────
// DATABASE_URL is the Supabase Postgres connection string, e.g.:
//   postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
// Supabase requires SSL; node-postgres needs rejectUnauthorized:false since
// Supabase's cert chain isn't in Node's default CA bundle.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
})

// ─── Helpers (drop-in replacement for the old @libsql/client API) ─────────
// Routes call these with SQLite-style `?` placeholders; we translate to the
// `$1, $2, ...` syntax Postgres expects so route code stays untouched.
function toPgSql(sql) {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

async function get(sql, args = []) {
  const r = await pool.query(toPgSql(sql), args)
  return r.rows[0] ?? null
}

async function all(sql, args = []) {
  const r = await pool.query(toPgSql(sql), args)
  return r.rows
}

async function run(sql, args = []) {
  let pgSql = toPgSql(sql)
  const isInsert = /^\s*INSERT/i.test(pgSql) && !/RETURNING/i.test(pgSql)
  if (isInsert) pgSql += ' RETURNING id'
  const r = await pool.query(pgSql, args)
  return { lastInsertRowid: r.rows[0]?.id ?? null, changes: r.rowCount }
}

async function exec(sql) {
  await pool.query(sql)
}

// ─── Schema ────────────────────────────────────────────────────────────────
async function createSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT        UNIQUE NOT NULL,
      full_name     TEXT        NOT NULL,
      email         TEXT        UNIQUE NOT NULL,
      password_hash TEXT        NOT NULL,
      role          TEXT        NOT NULL DEFAULT 'developer',
      active        INTEGER     NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login    TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS security_questions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question    TEXT    NOT NULL,
      answer_hash TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          SERIAL PRIMARY KEY,
      name        TEXT        NOT NULL,
      client      TEXT        NOT NULL,
      status      TEXT        NOT NULL DEFAULT 'Pendiente',
      priority    TEXT        NOT NULL DEFAULT 'Media',
      budget      REAL        NOT NULL DEFAULT 0,
      deadline    TEXT,
      progress    INTEGER     NOT NULL DEFAULT 0,
      tags        TEXT        NOT NULL DEFAULT '[]',
      description TEXT,
      created_by  INTEGER,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sprints (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER     NOT NULL,
      name       TEXT        NOT NULL,
      goal       TEXT,
      start_date TEXT,
      end_date   TEXT,
      status     TEXT        NOT NULL DEFAULT 'planning',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id           SERIAL PRIMARY KEY,
      title        TEXT        NOT NULL,
      description  TEXT,
      project      TEXT,
      project_id   INTEGER,
      sprint_id    INTEGER,
      assignee     TEXT,
      status       TEXT        NOT NULL DEFAULT 'Backlog',
      priority     TEXT        NOT NULL DEFAULT 'Media',
      type         TEXT        NOT NULL DEFAULT 'task',
      story_points INTEGER     NOT NULL DEFAULT 1,
      due          TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clients (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL,
      contact    TEXT,
      email      TEXT,
      sector     TEXT        NOT NULL DEFAULT 'Otro',
      status     TEXT        NOT NULL DEFAULT 'Prospecto',
      value      REAL        NOT NULL DEFAULT 0,
      projects   INTEGER     NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

// ─── Seed ──────────────────────────────────────────────────────────────────
async function seed() {
  const count = await get('SELECT COUNT(*) as n FROM users')
  if (Number(count.n) > 0) return

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

module.exports = { pool, get, all, run, exec, init }
