/**
 * One-off data migration: local SQLite (optimind.db) → Supabase Postgres.
 *
 * Usage:
 *   1. Set DATABASE_URL in api/.env to your Supabase connection string.
 *   2. node scripts/migrate-to-supabase.js
 *
 * Safe to re-run: skips a table if it already has rows in Postgres.
 */
require('dotenv').config()
const path = require('path')
const { createClient } = require('@libsql/client')
const { Pool } = require('pg')

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definido en api/.env')
  process.exit(1)
}

const sqlite = createClient({ url: `file:${path.join(__dirname, '..', 'optimind.db')}` })
const pg = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const TABLES = ['users', 'security_questions', 'projects', 'sprints', 'tasks', 'clients']

async function migrateTable(table) {
  const { rows: existing } = await pg.query(`SELECT COUNT(*) AS n FROM ${table}`)
  if (Number(existing[0].n) > 0) {
    console.log(`⏭  ${table}: ya tiene datos en Supabase, se omite`)
    return
  }

  const r = await sqlite.execute(`SELECT * FROM ${table}`)
  if (r.rows.length === 0) {
    console.log(`–  ${table}: sin filas en SQLite`)
    return
  }

  const columns = Object.keys(r.rows[0])
  for (const row of r.rows) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',')
    const values = columns.map(c => row[c])
    await pg.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      values
    )
  }

  // Keep the SERIAL sequence in sync with the migrated ids, otherwise the
  // next INSERT (without an explicit id) would collide with row ids we just copied.
  await pg.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
  )

  console.log(`✅ ${table}: ${r.rows.length} filas migradas`)
}

async function main() {
  for (const table of TABLES) {
    await migrateTable(table)
  }
  await pg.end()
  console.log('🎉 Migración completa')
}

main().catch(err => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
