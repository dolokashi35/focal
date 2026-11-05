import express from 'express'
import fs from 'node:fs'
import path from 'node:path'

const app = express()
app.use(express.json({ limit: '1mb' }))

const dataDir = path.join(process.cwd(), 'server', 'data')
fs.mkdirSync(dataDir, { recursive: true })

app.post('/focuslens/ingest', (req, res) => {
  const payload = req.body || {}
  const file = path.join(dataDir, `${Date.now()}.json`)
  fs.writeFile(file, JSON.stringify(payload, null, 2), () => {})
  res.json({ ok: true, stored: true })
})

app.get('/health', (_req, res) => res.json({ ok: true }))

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`[focuslens] ingest server listening on ${port}`))





