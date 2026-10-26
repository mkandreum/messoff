import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import helmet from 'helmet'
import type { PrismaClient } from '@prisma/client'
import { config } from './env'
import { apiLimiter } from './auth'
import { HttpError } from './errors'
import { createAuthRouter } from './routes/auth'
import { createEventsRouter } from './routes/events'
import { createTasksRouter } from './routes/tasks'
import { createFocusRouter } from './routes/focus'
import { createBootstrapRouter } from './routes/bootstrap'

export function createApp(prisma: PrismaClient) {
  const app = express()
  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: config.maxBody }))
  app.use(cookieParser())

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ ok: true, db: true, version: '1.0.0' })
    } catch {
      res.status(503).json({ ok: false, db: false })
    }
  })

  app.use('/api', apiLimiter)
  app.use('/api/auth', createAuthRouter(prisma))
  app.use('/api/bootstrap', createBootstrapRouter(prisma))
  app.use('/api/events', createEventsRouter(prisma))
  app.use('/api/tasks', createTasksRouter(prisma))
  app.use('/api/focus-sessions', createFocusRouter(prisma))

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', code: 'NOT_FOUND' })
  })

  const publicDir = path.resolve(process.cwd(), 'dist', 'public')
  if (fs.existsSync(publicDir)) {
    app.use(
      express.static(publicDir, {
        index: false,
        maxAge: config.isProd ? '1h' : 0,
      }),
    )
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(publicDir, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => {
      res
        .status(200)
        .type('text/plain')
        .send('API de Pulso. Arranca el frontend con Vite en :5180 o construye el proyecto.')
    })
  }

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message, code: error.code })
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        (error as { type?: string }).type === 'entity.parse.failed'
      ) {
        return res.status(400).json({ error: 'El cuerpo de la petición no es válido', code: 'BAD_JSON' })
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        return res.status(404).json({ error: 'No encontrado', code: 'NOT_FOUND' })
      }

      console.error('[api] error no controlado', error)
      const message = config.isProd ? 'Algo falló en el servidor' : String(error)
      res.status(500).json({ error: message, code: 'INTERNAL' })
    },
  )

  return app
}
