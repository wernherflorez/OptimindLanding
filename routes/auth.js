const express    = require('express')
const bcrypt     = require('bcryptjs')
const jwt        = require('jsonwebtoken')
const db         = require('../database')
const { authenticate }  = require('../middleware/auth')
const { sendTempPassword } = require('../mailer')

const router = require('express').Router()

function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const sign = (payload, expiresIn) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '8h' })

// ─── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username y password requeridos' })

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.trim().toLowerCase())
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' })
  }

  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id)

  const payload = { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role }
  res.json({ token: sign(payload), user: payload })
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, full_name, email, role, created_at, last_login FROM users WHERE id = ?'
  ).get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  res.json(user)
})

// ─── PUT /api/auth/change-password ───────────────────────────────────────
router.put('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos requeridos' })
  if (newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' })

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' })
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), user.id)
  res.json({ message: 'Contraseña actualizada' })
})

// ─── POST /api/auth/forgot – envía contraseña temporal por correo ─────────
router.post('/forgot', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  // Buscar usuario por email
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.trim().toLowerCase())

  // Responder siempre con 200 para no revelar si el email existe
  if (!user) {
    return res.json({ message: 'Si el correo está registrado, recibirás las instrucciones en breve.' })
  }

  const tempPass = generateTempPassword()
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(tempPass, 10), user.id)

  try {
    await sendTempPassword(user.email, user.full_name, tempPass)
    res.json({ message: 'Te enviamos una contraseña temporal a tu correo. Revisa también tu carpeta de spam.' })
  } catch (err) {
    console.error('SMTP error:', err.message)
    // Revertimos el hash para no dejar al usuario sin acceso si el correo falla
    res.status(500).json({ error: 'No se pudo enviar el correo. Contacta al administrador.' })
  }
})

// ─── Ruta legacy kept for backward compat – redirige a /forgot ───────────
router.post('/forgot/check',  (_, res) => res.status(410).json({ error: 'Ruta obsoleta. Usa POST /api/auth/forgot' }))
router.post('/forgot/verify', (_, res) => res.status(410).json({ error: 'Ruta obsoleta. Usa POST /api/auth/forgot' }))
router.post('/forgot/reset',  (_, res) => res.status(410).json({ error: 'Ruta obsoleta. Usa POST /api/auth/forgot' }))

module.exports = router
