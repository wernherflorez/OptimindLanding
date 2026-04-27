const express = require('express')
const db      = require('../database')
const { authenticate } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

// GET /api/sprints?project_id=X
router.get('/', (req, res) => {
  const { project_id } = req.query
  const rows = project_id
    ? db.prepare('SELECT * FROM sprints WHERE project_id = ? ORDER BY created_at DESC').all(Number(project_id))
    : db.prepare('SELECT * FROM sprints ORDER BY created_at DESC').all()
  res.json(rows)
})

// GET /api/sprints/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Sprint no encontrado' })
  res.json(row)
})

// POST /api/sprints
router.post('/', (req, res) => {
  const { project_id, name, goal, start_date, end_date, status } = req.body
  if (!project_id || !name) return res.status(400).json({ error: 'project_id y name son requeridos' })

  const id = db.prepare(`
    INSERT INTO sprints (project_id, name, goal, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(project_id, name, goal || null, start_date || null, end_date || null, status || 'planning').lastInsertRowid

  res.status(201).json(db.prepare('SELECT * FROM sprints WHERE id = ?').get(id))
})

// PUT /api/sprints/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Sprint no encontrado' })

  const merged = { ...existing, ...req.body }
  db.prepare(`
    UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?
  `).run(merged.name, merged.goal, merged.start_date, merged.end_date, merged.status, req.params.id)

  res.json(db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id))
})

// DELETE /api/sprints/:id
router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM sprints WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Sprint no encontrado' })
  }
  // Unassign tasks from this sprint instead of deleting them
  db.prepare('UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sprints WHERE id = ?').run(req.params.id)
  res.json({ message: 'Sprint eliminado' })
})

module.exports = router
