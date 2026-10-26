import { PrismaClient } from '@prisma/client'

export function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = createPrisma()
