import { Logo } from './ui'

export function Splash({ label = 'Abriendo tu semana…' }: { label?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash__mark">
        <Logo size={42} />
      </div>
      <span className="splash__word">pulso</span>
      <span className="splash__label">{label}</span>
      <span className="splash__line" aria-hidden="true">
        <i />
      </span>
    </div>
  )
}

export function LoadError({
  message,
  onRetry,
  onLogout,
}: {
  message: string
  onRetry: () => void
  onLogout: () => void
}) {
  return (
    <div className="splash splash--error" role="alert">
      <span className="splash__word">pulso</span>
      <p className="splash__label">No hemos podido cargar tu agenda.</p>
      <p className="splash__error">{message}</p>
      <div className="splash__actions">
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Reintentar
        </button>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
