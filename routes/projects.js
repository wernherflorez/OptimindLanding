const express = require('express')
const db      = require('../database')
const { authenticate } = require('../middleware/auth')
const { notifyNewProject } = require('../mailer')

const router = express.Router()
router.use(authenticate)

const parse  = p => ({ ...p, tags: JSON.parse(p.tags || '[]') })
const format = p => ({ ...p, tags: JSON.stringify(Array.isArray(p.tags) ? p.tags : []) })

// GET /api/projects
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
  res.json(rows.map(parse))
})

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' })
  res.json(parse(row))
})

// POST /api/projects
router.post('/', (req, res) => {
  const { name, client, status, priority, budget, deadline, progress, tags, description } = req.body
  if (!name || !client) return res.status(400).json({ error: 'name y client son requeridos' })

  const id = db.prepare(`
    INSERT INTO projects (name, client, status, priority, budget, deadline, progress, tags, description, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, client,
    status   || 'Pendiente',
    priority || 'Media',
    budget   || 0,
    deadline || null,
    progress || 0,
    JSON.stringify(Array.isArray(tags) ? tags : []),
    description || null,
    req.user.id
  ).lastInsertRowid

  const created = parse(db.prepare('SELECT * FROM projects WHERE id = ?').get(id))
  notifyNewProject(created, req.user?.full_name).catch(() => {})
  res.status(201).json(created)
})

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Proyecto no encontrado' })

  const merged = { ...parse(existing), ...req.body }

  db.prepare(`
    UPDATE projects
    SET name = ?, client = ?, status = ?, priority = ?, budget = ?, deadline = ?,
        progress = ?, tags = ?, description = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(merged.name, merged.client, merged.status, merged.priority, merged.budget, merged.deadline,
         merged.progress, JSON.stringify(Array.isArray(merged.tags) ? merged.tags : []),
         merged.description, req.params.id)

  res.json(parse(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)))
})

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' })
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ message: 'Proyecto eliminado' })
})

module.exports = router
