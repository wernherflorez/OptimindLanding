const express = require('express')
const { get, all, run } = require('../database')
const { authenticate } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query
    const rows = project_id
      ? await all('SELECT * FROM sprints WHERE project_id = ? ORDER BY created_at DESC', [Number(project_id)])
      : await all('SELECT * FROM sprints ORDER BY created_at DESC')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM sprints WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Sprint no encontrado' })
    res.json(row)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', async (req, res) => {
  try {
    const { project_id, name, goal, start_date, end_date, status } = req.body
    if (!project_id || !name) return res.status(400).json({ error: 'project_id y name son requeridos' })

    const { lastInsertRowid: id } = await run(
      'INSERT INTO sprints (project_id,name,goal,start_date,end_date,status) VALUES (?,?,?,?,?,?)',
      [project_id, name, goal || null, start_date || null, end_date || null, status || 'planning']
    )
    res.status(201).json(await get('SELECT * FROM sprints WHERE id = ?', [id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM sprints WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Sprint no encontrado' })

    const m = { ...existing, ...req.body }
    await run(
      'UPDATE sprints SET name=?,goal=?,start_date=?,end_date=?,status=? WHERE id=?',
      [m.name, m.goal, m.start_date, m.end_date, m.status, req.params.id]
    )
    res.json(await get('SELECT * FROM sprints WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    if (!await get('SELECT id FROM sprints WHERE id = ?', [req.params.id])) {
      return res.status(404).json({ error: 'Sprint no encontrado' })
    }
    await run('UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ?', [req.params.id])
    await run('DELETE FROM sprints WHERE id = ?', [req.params.id])
    res.json({ message: 'Sprint eliminado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
