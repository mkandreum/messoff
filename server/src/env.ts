import crypto from 'node:crypto'

const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const providedSecret = process.env.JWT_SECRET?.trim() || ''

if (providedSecret && providedSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres (openssl rand -base64 64)')
}

if (providedSecret.includes('cambia-esto')) {
  throw new Error('Cambia JWT_SECRET por un secreto real antes de arrancar (openssl rand -base64 64)')
}

if (!providedSecret && isProd) {
  throw new Error('JWT_SECRET es obligatorio en producción (openssl rand -base64 64)')
}

const devSecret = crypto.createHash('sha256').update('pulso-dev-only-secret').digest('base64')

const appOrigin = (process.env.APP_ORIGIN || '').replace(/\/$/, '')

export const config = {
  isProd,
  isTest,
  port: Number(process.env.PORT || 3001),
  jwtSecret: providedSecret || devSecret,
  appOrigin,
  cookieName: 'pulso_session',
  cookieSecure:
    process.env.COOKIE_SECURE === 'true' ||
    (isProd && appOrigin.startsWith('https://')),
  sessionDays: 60,
  trustProxy: process.env.TRUST_PROXY !== 'false',
  seedDemo: process.env.SEED_DEMO !== 'false',
  maxBody: '128kb',
}
