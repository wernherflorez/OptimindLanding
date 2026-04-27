const express = require('express')
const { get, all, run } = require('../database')
const { authenticate } = require('../middleware/auth')
const { notifyNewClient } = require('../mailer')

const router = express.Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM clients ORDER BY created_at DESC'))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM clients WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(row)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', async (req, res) => {
  try {
    const { name, contact, email, sector, status, value, projects } = req.body
    if (!name) return res.status(400).json({ error: 'name es requerido' })

    const { lastInsertRowid: id } = await run(
      'INSERT INTO clients (name,contact,email,sector,status,value,projects) VALUES (?,?,?,?,?,?,?)',
      [name, contact || null, email || null, sector || 'Otro', status || 'Prospecto', value || 0, projects || 0]
    )
    const created = await get('SELECT * FROM clients WHERE id = ?', [id])
    notifyNewClient(created, req.user?.full_name).catch(() => {})
    res.status(201).json(created)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM clients WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' })

    const m = { ...existing, ...req.body }
    await run(
      `UPDATE clients SET name=?,contact=?,email=?,sector=?,status=?,value=?,projects=?,updated_at=datetime('now') WHERE id=?`,
      [m.name, m.contact, m.email, m.sector, m.status, m.value, m.projects, req.params.id]
    )
    res.json(await get('SELECT * FROM clients WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    if (!await get('SELECT id FROM clients WHERE id = ?', [req.params.id])) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    await run('DELETE FROM clients WHERE id = ?', [req.params.id])
    res.json({ message: 'Cliente eliminado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
