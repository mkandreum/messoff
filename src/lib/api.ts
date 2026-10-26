export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code = 'ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/me']

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      'No se pudo conectar con el servidor. Comprueba tu conexión.',
      0,
      'NETWORK',
    )
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const payload = (data ?? {}) as { error?: string; code?: string }
    const message =
      payload.error ||
      (response.status === 401
        ? 'Tu sesión ha caducado. Vuelve a entrar.'
        : 'No se pudo completar la acción.')
    if (response.status === 401 && !AUTH_PATHS.some((p) => path.startsWith(p))) {
      window.dispatchEvent(new CustomEvent('pulso:unauthorized'))
    }
    throw new ApiError(message, response.status, payload.code || 'ERROR')
  }

  return (data ?? {}) as T
}
