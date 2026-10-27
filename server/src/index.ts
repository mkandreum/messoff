import { createApp } from './app'
import { config } from './env'
import { prisma } from './db'

const app = createApp(prisma)

const server = app.listen(config.port, () => {
  console.log(`[messoff] API escuchando en http://localhost:${config.port}`)
  if (!config.isProd) console.log('[messoff] Modo desarrollo: el frontend corre en Vite :5180')
})

async function shutdown(signal: string) {
  console.log(`[messoff] ${signal}: cerrando…`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
