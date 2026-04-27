const jwt = require('jsonwebtoken')

function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' })
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' })
  next()
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Acceso denegado' })
    next()
  }
}

module.exports = { authenticate, requireAdmin, requireRole }
