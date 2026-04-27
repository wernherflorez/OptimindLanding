require('dotenv').config()
require('./database') // Initialize DB on startup

const express = require('express')
const cors = require('cors')

const authRoutes     = require('./routes/auth')
const usersRoutes    = require('./routes/users')
const projectsRoutes = require('./routes/projects')
const sprintsRoutes  = require('./routes/sprints')
const tasksRoutes    = require('./routes/tasks')
const clientsRoutes  = require('./routes/clients')

const app  = express()
const PORT = process.env.PORT || 3001

// ─── CORS ─────────────────────────────────────────────────────────────────
const allowed = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const isDev   = (process.env.NODE_ENV || 'development') !== 'production'

app.use(cors({
  origin: (origin, cb) => {
    // En desarrollo: permite cualquier localhost sin importar el puerto
    if (!origin) return cb(null, true)
    if (isDev && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      return cb(null, true)
    }
    if (allowed.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} no permitido`))
  },
  credentials: true,
}))

app.use(express.json())

// ─── Routes ───────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

app.use('/api/auth',     authRoutes)
app.use('/api/users',    usersRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/sprints',  sprintsRoutes)
app.use('/api/tasks',    tasksRoutes)
app.use('/api/clients',  clientsRoutes)

// ─── Global error handler ─────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const server = app.listen(PORT, () => console.log(`🚀 OptiMind API corriendo en http://localhost:${PORT}`))

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ El puerto ${PORT} ya está en uso.`)
    console.error(`   Ejecuta este comando para liberarlo y vuelve a intentar:`)
    console.error(`   PowerShell: Get-NetTCPConnection -LocalPort ${PORT} | % { Stop-Process -Id $_.OwningProcess -Force }\n`)
    process.exit(1)
  } else {
    throw err
  }
})
