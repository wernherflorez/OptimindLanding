const express = require('express')
const bcrypt  = require('bcryptjs')
const { get, all, run } = require('../database')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

const safe = u => ({ id: u.id, username: u.username, full_name: u.full_name, email: u.email,
  role: u.role, active: u.active, created_at: u.created_at, last_login: u.last_login })

router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await all('SELECT id,username,full_name,email,role,active,created_at,last_login FROM users ORDER BY created_at DESC')
    const withQs = await Promise.all(users.map(async u => ({
      ...u,
      has_questions: (await get('SELECT COUNT(*) as n FROM security_questions WHERE user_id = ?', [u.id])).n > 0,
    })))
    res.json(withQs)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, full_name, email, password, role, security_questions } = req.body
    if (!username || !full_name || !email || !password) {
      return res.status(400).json({ error: 'username, full_name, email y password son requeridos' })
    }
    if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })

    const existing = await get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email])
    if (existing) return res.status(409).json({ error: 'Username o email ya existe' })

    const { lastInsertRowid: id } = await run(
      'INSERT INTO users (username,full_name,email,password_hash,role) VALUES (?,?,?,?,?)',
      [username.trim().toLowerCase(), full_name, email, bcrypt.hashSync(password, 10), role || 'developer']
    )

    if (security_questions?.length) {
      for (const sq of security_questions) {
        if (sq.question && sq.answer) {
          await run(
            'INSERT INTO security_questions (user_id,question,answer_hash) VALUES (?,?,?)',
            [id, sq.question, bcrypt.hashSync(sq.answer.trim().toLowerCase(), 10)]
          )
        }
      }
    }

    const user = await get('SELECT id,username,full_name,email,role,active,created_at FROM users WHERE id = ?', [id])
    res.status(201).json({ ...safe(user), has_questions: (security_questions?.length ?? 0) > 0 })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { full_name, email, role, active } = req.body
    const user = await get('SELECT id FROM users WHERE id = ?', [req.params.id])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    await run(
      `UPDATE users SET full_name=COALESCE(?,full_name), email=COALESCE(?,email),
       role=COALESCE(?,role), active=COALESCE(?,active) WHERE id=?`,
      [full_name ?? null, email ?? null, role ?? null,
       active !== undefined ? (active ? 1 : 0) : null, req.params.id]
    )

    const updated = await get('SELECT id,username,full_name,email,role,active,created_at,last_login FROM users WHERE id = ?', [req.params.id])
    const has_questions = (await get('SELECT COUNT(*) as n FROM security_questions WHERE user_id = ?', [req.params.id])).n > 0
    res.json({ ...safe(updated), has_questions })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id/password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' })
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.params.id])
    res.json({ message: 'Contraseña actualizada' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id/security-questions', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id)
    if (req.user.role !== 'admin' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Acceso denegado' })
    }
    const { security_questions } = req.body
    if (!security_questions?.length) return res.status(400).json({ error: 'Se requieren preguntas' })

    await run('DELETE FROM security_questions WHERE user_id = ?', [targetId])
    for (const sq of security_questions) {
      if (sq.question && sq.answer) {
        await run(
          'INSERT INTO security_questions (user_id,question,answer_hash) VALUES (?,?,?)',
          [targetId, sq.question, bcrypt.hashSync(sq.answer.trim().toLowerCase(), 10)]
        )
      }
    }
    res.json({ message: 'Preguntas de seguridad actualizadas' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' })
    }
    await run('DELETE FROM users WHERE id = ?', [req.params.id])
    res.json({ message: 'Usuario eliminado' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
