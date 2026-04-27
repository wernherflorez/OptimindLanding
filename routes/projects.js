const express = require('express')
const { get, all, run } = require('../database')
const { authenticate } = require('../middleware/auth')
const { notifyNewProject } = require('../mailer')

const router = express.Router()
router.use(authenticate)

const parse  = p => ({ ...p, tags: JSON.parse(p.tags || '[]') })
const format = tags => JSON.stringify(Array.isArray(tags) ? tags : [])

router.get('/', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM projects ORDER BY created_at DESC')
    res.json(rows.map(parse))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM projects WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' })
    res.json(parse(row))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', async (req, res) => {
  try {
    const { name, client, status, priority, budget, deadline, progress, tags, description } = req.body
    if (!name || !client) return res.status(400).json({ error: 'name y client son requeridos' })

    const { lastInsertRowid: id } = await run(
      `INSERT INTO projects (name,client,status,priority,budget,deadline,progress,tags,description,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, client, status || 'Pendiente', priority || 'Media', budget || 0,
       deadline || null, progress || 0, format(tags), description || null, req.user.id]
    )
    const created = parse(await get('SELECT * FROM projects WHERE id = ?', [id]))
    notifyNewProject(created, req.user?.full_name).catch(() => {})
    res.status(201).json(created)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM projects WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Proyecto no encontrado' })

    const m = { ...parse(existing), ...req.body }
    await run(
      `UPDATE projects SET name=?,client=?,status=?,priority=?,budget=?,deadline=?,
       progress=?,tags=?,description=?,updated_at=datetime('now') WHERE id=?`,
      [m.name, m.client, m.status, m.priority, m.budget, m.deadline,
       m.progress, format(m.tags), m.description, req.params.id]
    )
    res.json(parse(await get('SELECT * FROM projects WHERE id = ?', [req.params.id])))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    const row = await get('SELECT id FROM projects WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' })
    await run('DELETE FROM projects WHERE id = ?', [req.params.id])
    res.json({ message: 'Proyecto eliminado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
