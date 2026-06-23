const natural = require('natural')

const classifier = new natural.BayesClassifier(natural.PorterStemmerEs)

const training = {
  saludo: [
    'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal', 'hey', 'holaa', 'saludos', 'buen dia',
  ],
  servicios: [
    'que servicios ofrecen', 'que hacen', 'que servicios tienen', 'en que me pueden ayudar',
    'que desarrollan', 'cuales son sus servicios', 'a que se dedican', 'que tipo de proyectos hacen',
    'hacen apps', 'hacen paginas web', 'hacen dashboards', 'hacen automatizaciones', 'integran pagos',
    'desarrollan software', 'que puedo contratar', 'que ofrecen',
  ],
  precio: [
    'cuanto cuesta', 'cuanto vale', 'cual es el precio', 'cual es el costo', 'que precio tienen',
    'cuanto cobran', 'cual es el presupuesto', 'tarifas', 'cuanto me costaria un proyecto',
    'es caro', 'manejan planes de pago', 'cuanto sale', 'precios', 'cuanto me cobrarian',
    'cuanto cuesta una pagina web', 'cuanto me costaria una pagina web', 'cuanto cuesta un sitio web',
    'cuanto cuesta una app', 'cuanto me costaria un mvp', 'que tan caro es', 'es economico',
  ],
  tiempo: [
    'cuanto tiempo tarda', 'en cuanto tiempo entregan', 'cuando estaria listo', 'cuanto demora un proyecto',
    'que tan rapido trabajan', 'cuanto se tarda el mvp', 'tiempos de entrega', 'fecha de entrega',
    'cuanto demoran', 'que tan rapido entregan',
  ],
  contacto: [
    'como los contacto', 'como agendo una consulta', 'quiero hablar con alguien', 'tienen whatsapp',
    'cual es su correo', 'como programo una reunion', 'quiero el diagnostico gratuito', 'como empiezo',
    'quiero un proyecto', 'como hablo con un asesor', 'donde los encuentro',
  ],
  tecnologia: [
    'que tecnologia usan', 'en que lenguaje programan', 'usan react', 'usan node', 'que stack manejan',
    'usan la nube', 'es seguro', 'cumplen con pci', 'con que trabajan', 'que framework usan',
  ],
  pymes: [
    'trabajan con pymes', 'atienden empresas pequenas', 'en que sectores trabajan', 'trabajan con retail',
    'trabajan con fintech', 'trabajan con salud', 'solo trabajan en colombia', 'trabajan fuera de colombia',
  ],
  otro: [
    'el clima de hoy', 'cuentame un chiste', 'quien eres', 'que hora es', 'me gustan los gatos',
    'asdkjasd', 'jajaja', 'no entendi nada', 'esto es una prueba', 'cualquier cosa', 'no se',
  ],
}

for (const [intent, examples] of Object.entries(training)) {
  examples.forEach(example => classifier.addDocument(example, intent))
}
classifier.train()

const REPLIES = {
  saludo: '¡Hola! 👋 Soy el asistente de **OptiMind Solutions**. Puedo contarte sobre nuestros servicios, precios, tiempos de entrega o ayudarte a agendar un diagnóstico gratuito. ¿Qué necesitas?',
  servicios: 'Ofrecemos 5 servicios principales:\n\n🌐 **Plataformas Web & APIs** personalizadas\n⚙️ **Automatización de procesos** (−30% tiempo operativo)\n📊 **Dashboards BI** con Power BI\n💳 **Integración PSE** y pasarelas de pago\n🔧 **Mantenimiento & Soporte** continuo\n\n¿Sobre cuál quieres saber más?',
  precio: 'Nuestros proyectos van desde **$600.000 hasta $2.500.000 COP** dependiendo del alcance.\n\n💰 Desarrollo web básico: desde $600K\n🚀 Plataformas con BI o integraciones: hasta $2.5M\n🔧 Mantenimiento mensual: según SLA\n\nPrecios cerrados, sin cobros ocultos. ¿Quieres un diagnóstico gratuito para estimar tu proyecto?',
  tiempo: '⚡ Entregamos MVPs funcionales en **4–6 semanas**.\n\n• Semana 1: Diagnóstico y propuesta\n• Semanas 2–5: Desarrollo en sprints\n• Semana 6: Lanzamiento y capacitación\n\nDemos quincenales para que veas avances reales.',
  contacto: '📅 Puedes agendar tu **diagnóstico gratuito de 30 min** directamente:\n\n✉️ Email: FlorezWernher26@gmail.com\n📱 WhatsApp: +57 321 307 4133\n📝 Formulario de contacto abajo en la página\n\nTe respondemos en menos de 24 horas.',
  tecnologia: 'Trabajamos con tecnologías modernas y escalables:\n\n⚛️ **Frontend**: React + Tailwind CSS\n🟢 **Backend**: Node.js + Express\n☁️ **Cloud**: Azure / AWS / GCP\n📊 **BI**: Power BI\n🔐 **Auth**: JWT + PCI-DSS compliant',
  pymes: 'Trabajamos con **Pymes de 10 a 200 empleados** en:\n\n🛍️ Retail\n💰 Fintech\n📦 Logística\n🏥 Salud\n\nNuestro mercado base es Colombia, con expansión a la región Andina y Latinoamérica.',
  otro: 'Gracias por tu mensaje. Para darte la mejor respuesta, te recomiendo llenar el **formulario de contacto** en esta misma página o escribirnos a FlorezWernher26@gmail.com. ¿Hay algo puntual sobre nuestros servicios, precios o tiempos en lo que te pueda ayudar?',
}

function getReply(message) {
  const intent = classifier.classify(message)
  return REPLIES[intent] || REPLIES.otro
}

module.exports = { getReply }
