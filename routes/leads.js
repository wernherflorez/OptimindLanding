const express = require('express')
const { get, all, run } = require('../database')
const { authenticate } = require('../middleware/auth')
const { notifyNewLead } = require('../mailer')

const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const { name, email, company, sector, budget, message } = req.body
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email y message son requeridos' })
    }

    const { lastInsertRowid: id } = await run(
      'INSERT INTO leads (name,email,company,sector,budget,message) VALUES (?,?,?,?,?,?)',
      [name, email, company || null, sector || null, budget || null, message]
    )
    const created = await get('SELECT * FROM leads WHERE id = ?', [id])
    notifyNewLead(created).catch(() => {})
    res.status(201).json({ message: 'Mensaje enviado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/', authenticate, async (req, res) => {
  try {
    res.json(await all('SELECT * FROM leads ORDER BY created_at DESC'))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/seen', authenticate, async (req, res) => {
  try {
    await run('UPDATE leads SET seen = TRUE WHERE seen = FALSE')
    res.json({ message: 'Notificaciones marcadas como vistas' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await get('SELECT * FROM leads WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Lead no encontrado' })

    const m = { ...existing, ...req.body }
    await run('UPDATE leads SET status=?, seen=? WHERE id=?', [m.status, m.seen, req.params.id])
    res.json(await get('SELECT * FROM leads WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!await get('SELECT id FROM leads WHERE id = ?', [req.params.id])) {
      return res.status(404).json({ error: 'Lead no encontrado' })
    }
    await run('DELETE FROM leads WHERE id = ?', [req.params.id])
    res.json({ message: 'Lead eliminado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
