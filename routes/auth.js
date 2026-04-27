const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const { get, run } = require('../database')
const { authenticate } = require('../middleware/auth')
const { sendTempPassword } = require('../mailer')

const router = require('express').Router()

function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' })

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username y password requeridos' })

    const user = await get('SELECT * FROM users WHERE username = ? AND active = 1', [username.trim().toLowerCase()])
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    await run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id])

    const payload = { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role }
    res.json({ token: sign(payload), user: payload })
  } catch (e) { res.status(500).json({ error: 'Error interno' }) }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await get(
      'SELECT id,username,full_name,email,role,created_at,last_login FROM users WHERE id = ?',
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(user)
  } catch (e) { res.status(500).json({ error: 'Error interno' }) }
})

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos requeridos' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' })

    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), user.id])
    res.json({ message: 'Contraseña actualizada' })
  } catch (e) { res.status(500).json({ error: 'Error interno' }) }
})

// POST /api/auth/forgot
router.post('/forgot', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  const user = await get('SELECT * FROM users WHERE email = ? AND active = 1', [email.trim().toLowerCase()])
  if (!user) return res.json({ message: 'Si el correo está registrado, recibirás las instrucciones en breve.' })

  const tempPass = generateTempPassword()
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(tempPass, 10), user.id])

  try {
    await sendTempPassword(user.email, user.full_name, tempPass)
    res.json({ message: 'Te enviamos una contraseña temporal a tu correo.' })
  } catch (err) {
    console.error('SMTP error:', err.message)
    res.status(500).json({ error: 'No se pudo enviar el correo. Contacta al administrador.' })
  }
})

router.post('/forgot/check',  (_, res) => res.status(410).json({ error: 'Ruta obsoleta' }))
router.post('/forgot/verify', (_, res) => res.status(410).json({ error: 'Ruta obsoleta' }))
router.post('/forgot/reset',  (_, res) => res.status(410).json({ error: 'Ruta obsoleta' }))

module.exports = router
