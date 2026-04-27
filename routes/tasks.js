const express = require('express')
const { get, all, run } = require('../database')
const { authenticate } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    const { project_id, sprint_id, type } = req.query
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const args = []
    if (project_id) { sql += ' AND project_id = ?'; args.push(Number(project_id)) }
    if (sprint_id === 'null') { sql += ' AND sprint_id IS NULL' }
    else if (sprint_id) { sql += ' AND sprint_id = ?'; args.push(Number(sprint_id)) }
    if (type) { sql += ' AND type = ?'; args.push(type) }
    sql += ' ORDER BY created_at DESC'
    res.json(await all(sql, args))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Tarea no encontrada' })
    res.json(row)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', async (req, res) => {
  try {
    const { title, description, project, project_id, sprint_id, assignee, status, priority, type, story_points, due } = req.body
    if (!title) return res.status(400).json({ error: 'title es requerido' })

    const { lastInsertRowid: id } = await run(
      `INSERT INTO tasks (title,description,project,project_id,sprint_id,assignee,status,priority,type,story_points,due)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [title, description || null, project || null, project_id || null, sprint_id || null,
       assignee || null, status || 'Backlog', priority || 'Media', type || 'task', story_points || 1, due || null]
    )
    res.status(201).json(await get('SELECT * FROM tasks WHERE id = ?', [id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Tarea no encontrada' })

    const m = { ...existing, ...req.body }
    const sprintId = req.body.hasOwnProperty('sprint_id') ? req.body.sprint_id : existing.sprint_id

    await run(
      `UPDATE tasks SET title=?,description=?,project=?,project_id=?,sprint_id=?,
       assignee=?,status=?,priority=?,type=?,story_points=?,due=?,updated_at=datetime('now') WHERE id=?`,
      [m.title, m.description, m.project, m.project_id, sprintId,
       m.assignee, m.status, m.priority, m.type, m.story_points, m.due, req.params.id]
    )
    res.json(await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    if (!await get('SELECT id FROM tasks WHERE id = ?', [req.params.id])) {
      return res.status(404).json({ error: 'Tarea no encontrada' })
    }
    await run('DELETE FROM tasks WHERE id = ?', [req.params.id])
    res.json({ message: 'Tarea eliminada' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
