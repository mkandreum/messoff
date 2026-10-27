import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Info,
  Loader2,
  LockKeyhole,
  Mail,
  Move,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../auth'
import { ApiError } from '../lib/api'
import { Logo } from './ui'

type Mode = 'login' | 'register'

const FEATURES = [
  {
    icon: Move,
    title: 'Arrastra y siente',
    copy: 'Mueve un evento de día con un gesto y una vibración que confirma.',
  },
  {
    icon: Timer,
    title: 'Enfoque sin ruido',
    copy: 'Un temporizador que convive con tu agenda, no contra ella.',
  },
  {
    icon: ShieldCheck,
    title: 'Tus datos, tuyos',
    copy: 'Cada cuenta tiene su propio espacio en una base de datos tuya.',
  },
]

export function AuthScreen() {
  const { login, register, bootError, notice, clearNotice } = useAuth()
  const [mode, setMode] = useState<Mode>(() =>
    new URLSearchParams(window.location.search).has('join') ? 'register' : 'login',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setError(null)
    setPassword('')
    setConfirm('')
    const timer = window.setTimeout(() => {
      if (mode === 'register') nameRef.current?.focus()
      else emailRef.current?.focus()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [mode])

  useEffect(() => {
    if (notice) clearNotice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(null)

    const cleanEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('Escribe un email válido.')
      return
    }
    if (mode === 'register' && !name.trim()) {
      setError('Escribe tu nombre.')
      return
    }
    if (mode === 'register' && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!password) {
      setError('Escribe tu contraseña.')
      return
    }
    if (mode === 'register' && password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        await login(cleanEmail, password)
      } else {
        await register(name.trim(), cleanEmail, password)
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo completar la operación. Inténtalo otra vez.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <section className="auth__intro" aria-label="Sobre MessOff">
        <div className="auth__brand">
          <Logo size={34} />
          <span>messoff</span>
        </div>

        <p className="eyebrow">
          <span className="eyebrow__dot" aria-hidden="true" />
          Agenda personal · edición papel
        </p>
        <h1 className="auth__title">
          Tu semana,{' '}
          <br />
          <em>sin desorden.</em>
        </h1>
        <p className="auth__lead">
          Un calendario que se siente como papel y responde como una app. Sin ruido, sin
          reuniones que se pierden y sin colores de dashboard.
        </p>

        <div className="auth__week" aria-hidden="true">
          <div className="auth__col">
            <span>LUN</span>
            <i className="is-work" />
            <i className="is-social" />
          </div>
          <div className="auth__col">
            <span>MAR</span>
            <i className="is-focus" />
            <i className="is-health" />
            <i className="is-social" />
          </div>
          <div className="auth__col">
            <span>MIÉ</span>
            <i className="is-work" />
            <i className="is-social" />
          </div>
          <div className="auth__col">
            <span>JUE</span>
            <i className="is-health" />
            <i className="is-work" />
            <i className="is-focus" />
          </div>
          <div className="auth__col">
            <span>VIE</span>
            <i className="is-work" />
          </div>
          <div className="auth__col auth__col--faded">
            <span>SÁB</span>
            <i className="is-social" />
            <i className="is-health" />
          </div>
        </div>

        <ul className="auth__features">
          {FEATURES.map(({ icon: Icon, title, copy }) => (
            <li key={title}>
              <span className="auth__feature-icon">
                <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span>
                <strong>{title}</strong>
                <em>{copy}</em>
              </span>
            </li>
          ))}
        </ul>

        <p className="auth__quote">
          «Deja aire entre las cosas.
          <br />
          También es parte del plan.»
        </p>
      </section>

      <section className="auth__panel" aria-label="Acceso a tu cuenta">
        <div className="auth__card">
          <div className="auth__cardbrand">
            <Logo size={28} />
            <span>messoff</span>
          </div>

          <div className="auth__tabs" role="tablist" aria-label="Entrar o crear cuenta">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'is-active' : ''}
              onClick={() => setMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'is-active' : ''}
              onClick={() => setMode('register')}
            >
              Crear cuenta
            </button>
          </div>

          <header className="auth__cardhead">
            <p className="eyebrow">
              <span className="eyebrow__dot" aria-hidden="true" />
              {mode === 'login' ? 'Bienvenido de nuevo' : 'Empieza con aire'}
            </p>
            <h2>{mode === 'login' ? 'Entra en tu semana.' : 'Crea tu espacio.'}</h2>
            <p>
              {mode === 'login'
                ? 'Tus eventos, tus tareas y tu foco. Justo donde los dejaste.'
                : 'Treinta segundos y una semana entera por delante.'}
            </p>
          </header>

          {new URLSearchParams(window.location.search).has('join') && (
            <p className="auth__notice">
              <Info size={15} strokeWidth={1.8} aria-hidden="true" />
              Te han invitado a un equipo. Entra o crea tu cuenta y te unirás automáticamente.
            </p>
          )}
          {notice && (
            <p className="auth__notice">
              <Info size={15} strokeWidth={1.8} aria-hidden="true" />
              {notice}
            </p>
          )}
          {bootError && (
            <p className="auth__notice auth__notice--warn">
              <AlertCircle size={15} strokeWidth={1.8} aria-hidden="true" />
              {bootError}
            </p>
          )}
          {error && (
            <p className="auth__error" role="alert">
              <AlertCircle size={15} strokeWidth={1.8} aria-hidden="true" />
              {error}
            </p>
          )}

          <form className="auth__form" onSubmit={submit} noValidate>
            {mode === 'register' && (
              <label className="field">
                <span className="field__label">Tu nombre</span>
                <span className="field__box">
                  <UserRound size={16} strokeWidth={1.7} aria-hidden="true" />
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Daniel"
                    autoComplete="name"
                    maxLength={60}
                    required
                  />
                </span>
              </label>
            )}

            <label className="field">
              <span className="field__label">Email</span>
              <span className="field__box">
                <Mail size={16} strokeWidth={1.7} aria-hidden="true" />
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                />
              </span>
            </label>

            <label className="field">
              <span className="field__label">Contraseña</span>
              <span className="field__box">
                <LockKeyhole size={16} strokeWidth={1.7} aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="field__eye"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff size={16} strokeWidth={1.7} aria-hidden="true" />
                  ) : (
                    <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
                  )}
                </button>
              </span>
            </label>

            {mode === 'register' && (
              <label className="field">
                <span className="field__label">Repite la contraseña</span>
                <span className="field__box">
                  <Check size={16} strokeWidth={1.7} aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Otra vez"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </span>
              </label>
            )}

            <button type="submit" className="auth__submit" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={17} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
              )}
              {busy
                ? 'Un momento…'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Crear mi cuenta'}
              {!busy && <ArrowRight size={16} strokeWidth={1.9} aria-hidden="true" />}
            </button>
          </form>

          <div className="auth__switch">
            <CalendarDays size={14} strokeWidth={1.7} aria-hidden="true" />
            {mode === 'login' ? (
              <span>
                ¿Primera vez?{' '}
                <button type="button" onClick={() => setMode('register')}>
                  Crea tu cuenta
                </button>
              </span>
            ) : (
              <span>
                ¿Ya tienes cuenta?{' '}
                <button type="button" onClick={() => setMode('login')}>
                  Entra
                </button>
              </span>
            )}
          </div>

          <p className="auth__legal">
            Al crear una cuenta aceptas que guardemos tus eventos, tareas y sesiones de
            enfoque para darte el servicio. Nada de publicidad ni terceros.
          </p>
        </div>
        <p className="auth__foot">
          MessOff · papel, tinta y un poco de bermellón.
        </p>
      </section>
    </main>
  )
}
