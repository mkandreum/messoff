import type { NextFunction, Request, RequestHandler, Response } from 'express'

export class HttpError extends Error {
  status: number
  code: string

  constructor(status: number, message: string, code = 'ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next)
  }

export function notFound(message = 'Recurso no encontrado') {
  return new HttpError(404, message, 'NOT_FOUND')
}
