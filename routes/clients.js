const express = require('express')
const db      = require('../database')
const { authenticate } = require('../middleware/auth')
const { notifyNewClient } = require('../mailer')

const router = express.Router()
router.use(authenticate)

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all())
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Cliente no encontrado' })
  res.json(row)
})

router.post('/', (req, res) => {
  const { name, contact, email, sector, status, value, projects } = req.body
  if (!name) return res.status(400).json({ error: 'name es requerido' })

  const id = db.prepare(
    'INSERT INTO clients (name, contact, email, sector, status, value, projects) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, contact || null, email || null, sector || 'Otro', status || 'Prospecto', value || 0, projects || 0).lastInsertRowid

  const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(id)
  notifyNewClient(created, req.user?.full_name).catch(() => {})
  res.status(201).json(created)
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' })

  const merged = { ...existing, ...req.body }

  db.prepare(`
    UPDATE clients
    SET name = ?, contact = ?, email = ?, sector = ?, status = ?, value = ?, projects = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(merged.name, merged.contact, merged.email, merged.sector, merged.status, merged.value, merged.projects, req.params.id)

  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Cliente no encontrado' })
  }
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id)
  res.json({ message: 'Cliente eliminado' })
})

module.exports = router
