const express = require('express')
const db      = require('../database')
const { authenticate } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

router.get('/', (req, res) => {
  const { project_id, sprint_id, type } = req.query
  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params = []
  if (project_id) { sql += ' AND project_id = ?'; params.push(Number(project_id)) }
  if (sprint_id === 'null') { sql += ' AND sprint_id IS NULL' }
  else if (sprint_id) { sql += ' AND sprint_id = ?'; params.push(Number(sprint_id)) }
  if (type) { sql += ' AND type = ?'; params.push(type) }
  sql += ' ORDER BY created_at DESC'
  res.json(db.prepare(sql).all(...params))
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Tarea no encontrada' })
  res.json(row)
})

router.post('/', (req, res) => {
  const { title, description, project, project_id, sprint_id, assignee, status, priority, type, story_points, due } = req.body
  if (!title) return res.status(400).json({ error: 'title es requerido' })

  const id = db.prepare(`
    INSERT INTO tasks (title, description, project, project_id, sprint_id, assignee, status, priority, type, story_points, due)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, description || null, project || null,
    project_id || null, sprint_id || null,
    assignee || null, status || 'Backlog',
    priority || 'Media', type || 'task',
    story_points || 1, due || null
  ).lastInsertRowid

  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id))
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Tarea no encontrada' })

  const m = { ...existing, ...req.body }
  // Allow explicit null for sprint_id (move to backlog)
  const sprintId = req.body.hasOwnProperty('sprint_id') ? req.body.sprint_id : existing.sprint_id

  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, project = ?, project_id = ?, sprint_id = ?,
        assignee = ?, status = ?, priority = ?, type = ?, story_points = ?,
        due = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(m.title, m.description, m.project, m.project_id, sprintId,
         m.assignee, m.status, m.priority, m.type, m.story_points,
         m.due, req.params.id)

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.json({ message: 'Tarea eliminada' })
})

module.exports = router
