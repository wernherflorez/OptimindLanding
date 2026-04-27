const express = require('express')
const bcrypt  = require('bcryptjs')
const db      = require('../database')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

const safe = u => ({ id: u.id, username: u.username, full_name: u.full_name, email: u.email, role: u.role, active: u.active, created_at: u.created_at, last_login: u.last_login })

// GET /api/users
router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id,username,full_name,email,role,active,created_at,last_login FROM users ORDER BY created_at DESC').all()
  // Attach question count
  const withQs = users.map(u => ({
    ...u,
    has_questions: db.prepare('SELECT COUNT(*) as n FROM security_questions WHERE user_id = ?').get(u.id).n > 0,
  }))
  res.json(withQs)
})

// POST /api/users
router.post('/', requireAdmin, (req, res) => {
  const { username, full_name, email, password, role, security_questions } = req.body
  if (!username || !full_name || !email || !password) {
    return res.status(400).json({ error: 'username, full_name, email y password son requeridos' })
  }
  if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email)
  if (existing) return res.status(409).json({ error: 'Username o email ya existe' })

  const id = db.prepare(
    'INSERT INTO users (username, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(username.trim().toLowerCase(), full_name, email, bcrypt.hashSync(password, 10), role || 'developer').lastInsertRowid

  if (security_questions?.length) {
    const insertQ = db.prepare('INSERT INTO security_questions (user_id, question, answer_hash) VALUES (?, ?, ?)')
    for (const sq of security_questions) {
      if (sq.question && sq.answer) {
        insertQ.run(id, sq.question, bcrypt.hashSync(sq.answer.trim().toLowerCase(), 10))
      }
    }
  }

  const user = db.prepare('SELECT id,username,full_name,email,role,active,created_at FROM users WHERE id = ?').get(id)
  res.status(201).json({ ...safe(user), has_questions: (security_questions?.length ?? 0) > 0 })
})

// PUT /api/users/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { full_name, email, role, active } = req.body
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  db.prepare(`
    UPDATE users
    SET full_name  = COALESCE(?, full_name),
        email      = COALESCE(?, email),
        role       = COALESCE(?, role),
        active     = COALESCE(?, active)
    WHERE id = ?
  `).run(full_name ?? null, email ?? null, role ?? null, active !== undefined ? (active ? 1 : 0) : null, req.params.id)

  const updated = db.prepare('SELECT id,username,full_name,email,role,active,created_at,last_login FROM users WHERE id = ?').get(req.params.id)
  const has_questions = db.prepare('SELECT COUNT(*) as n FROM security_questions WHERE user_id = ?').get(req.params.id).n > 0
  res.json({ ...safe(updated), has_questions })
})

// PUT /api/users/:id/password  (admin resets any user password)
router.put('/:id/password', requireAdmin, (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' })
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.params.id)
  res.json({ message: 'Contraseña actualizada' })
})

// PUT /api/users/:id/security-questions (admin or self)
router.put('/:id/security-questions', (req, res) => {
  const targetId = parseInt(req.params.id)
  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }
  const { security_questions } = req.body
  if (!security_questions?.length) return res.status(400).json({ error: 'Se requieren preguntas' })

  db.prepare('DELETE FROM security_questions WHERE user_id = ?').run(targetId)
  const insertQ = db.prepare('INSERT INTO security_questions (user_id, question, answer_hash) VALUES (?, ?, ?)')
  for (const sq of security_questions) {
    if (sq.question && sq.answer) {
      insertQ.run(targetId, sq.question, bcrypt.hashSync(sq.answer.trim().toLowerCase(), 10))
    }
  }
  res.json({ message: 'Preguntas de seguridad actualizadas' })
})

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' })
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ message: 'Usuario eliminado' })
})

module.exports = router
