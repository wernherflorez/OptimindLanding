require('dotenv').config()
const nodemailer = require('nodemailer')

const ADMIN_EMAIL = 'FlorezWernher26@gmail.com'

const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function baseHtml(title, content) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#0d2137 0%,#0b5f6b 60%,#0e9da3 100%);padding:28px 36px;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.15);border:2px solid rgba(20,184,166,0.6);display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-weight:900;font-size:14px;letter-spacing:-0.5px">OM</span>
        </div>
        <span style="color:#fff;font-weight:800;font-size:16px;">OptiMind Solutions</span>
      </div>
      <h1 style="color:#fff;margin:14px 0 0;font-size:20px;font-weight:800;">${title}</h1>
    </div>
    <div style="padding:32px 36px;">
      ${content}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f3f4f6;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Dashboard OptiMind Solutions · Notificación automática</p>
      </div>
    </div>
  </div>`
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;color:#0d2137;font-size:13px;font-weight:600;">${value || '—'}</td>
  </tr>`
}

// ── Skip silently if SMTP not configured ──────────────────────────────────
async function send(opts) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `OptiMind Solutions <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      ...opts,
    })
  } catch (err) {
    console.error('📧 Mailer error:', err.message)
  }
}

// ── Nuevo proyecto ─────────────────────────────────────────────────────────
async function notifyNewProject(project, createdBy) {
  const content = `
    <p style="color:#374151;font-size:14px;margin:0 0 20px;">Se registró un nuevo proyecto en el dashboard:</p>
    <div style="background:#f0fafa;border:1.5px solid #0e9da3;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        ${row('Proyecto', project.name)}
        ${row('Cliente', project.client)}
        ${row('Estado', project.status)}
        ${row('Prioridad', project.priority)}
        ${row('Presupuesto', project.budget ? formatCOP(project.budget) : null)}
        ${row('Fecha límite', project.deadline)}
        ${row('Creado por', createdBy || 'Sistema')}
      </table>
    </div>
    <p style="color:#6b7280;font-size:13px;">Revisa el dashboard para ver todos los detalles y asignar tareas al equipo.</p>`
  await send({
    subject: `🚀 Nuevo proyecto: ${project.name} · ${project.client}`,
    html: baseHtml(`Nuevo proyecto registrado`, content),
  })
}

// ── Nuevo cliente ──────────────────────────────────────────────────────────
async function notifyNewClient(client, createdBy) {
  const content = `
    <p style="color:#374151;font-size:14px;margin:0 0 20px;">Se registró un nuevo cliente potencial:</p>
    <div style="background:#f0fafa;border:1.5px solid #0e9da3;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        ${row('Empresa', client.name)}
        ${row('Contacto', client.contact)}
        ${row('Email', client.email)}
        ${row('Sector', client.sector)}
        ${row('Estado', client.status)}
        ${row('Valor contrato', client.value ? formatCOP(client.value) : null)}
        ${row('Registrado por', createdBy || 'Sistema')}
      </table>
    </div>
    <p style="color:#6b7280;font-size:13px;">Recuerda hacer seguimiento en las próximas 24 horas para cerrar el prospecto.</p>`
  await send({
    subject: `👤 Nuevo cliente: ${client.name} · ${client.sector}`,
    html: baseHtml(`Nuevo cliente registrado`, content),
  })
}

// ── Contraseña temporal (reutilizado desde auth.js) ────────────────────────
async function sendTempPassword(toEmail, fullName, tempPass, frontendUrl) {
  const content = `
    <p style="color:#374151;font-size:14px;margin:0 0 20px;">Hola, <strong>${fullName}</strong> 👋<br/>
    Recibimos una solicitud para restablecer tu contraseña.</p>
    <div style="background:#f0fafa;border:2px solid #0e9da3;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="color:#6b7280;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Tu contraseña temporal</p>
      <span style="font-family:monospace;font-size:28px;font-weight:700;color:#0d2137;letter-spacing:4px;">${tempPass}</span>
    </div>
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="color:#854d0e;font-size:13px;margin:0;">⚠️ <strong>Inicia sesión y cambia tu contraseña de inmediato.</strong> Expira en 24 horas.</p>
    </div>
    <a href="${frontendUrl || 'http://localhost:5173'}/login"
       style="display:block;background:#0e9da3;color:#fff;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px;">
      Ir al Login →
    </a>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:20px 0 0;">Si no solicitaste esto, ignora este correo.</p>`
  await send({
    to: toEmail,
    subject: '🔑 OptiMind – Tu contraseña temporal',
    html: baseHtml('Contraseña temporal', content),
  })
}

module.exports = { notifyNewProject, notifyNewClient, sendTempPassword }
