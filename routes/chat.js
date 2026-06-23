const express = require('express')
const { getReply } = require('../chatbot/classifier')

const router = express.Router()

router.post('/', (req, res) => {
  const { message } = req.body
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message es requerido' })
  }
  res.json({ reply: getReply(message) })
})

module.exports = router
