import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import {
  Check,
  KeyRound,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type { HapticKind } from '../types'
import { ApiError } from '../lib/api'
import { HAPTIC_SUPPORTED, haptic } from '../lib/haptics'
import { useFocusTrap } from '../lib/focus'
import { useAuth } from '../auth'
import { usePlanner } from '../state'
import { initials, Switch } from './ui'

const TESTS: { id: HapticKind; label: string }[] = [
  { id: 'light', label: 'Toque' },
  { id: 'medium', label: 'Medio' },
  { id: 'success', label: 'Logro' },
  { id: 'error', label: 'Aviso' },
]

const message = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback

export function SettingsMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuth()
  const { user, theme, setTheme, hapticsEnabled, setHaptics, notify } = usePlanner()
  const [tested, setTested] = useState<string | null>(null)
  const [name, setName] = useState(user.name)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  useFocusTrap(panel, open, onClose)

  useEffect(() => {
    if (!open) return
    setName(user.name)
    setProfileError(null)
    setShowPassword(false)
    setCurrentPassword('')
    setNewPassword('')
    setPasswordError(null)
    setConfirmDelete(false)
    setDeletePassword('')
    setDeleteError(null)
  }, [open, user.name])

  const test = (kind: HapticKind, label: string) => {
    haptic(kind)
    setTested(label)
    window.setTimeout(() => setTested(null), 1400)
  }

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const next = name.replace(/\s+/g, ' ').trim()
    if (!next || next === user.name) return
    setProfileBusy(true)
    setProfileError(null)
    try {
      await auth.updateProfile({ name: next })
      haptic('success')
      notify('Nombre actualizado')
    } catch (error) {
      setProfileError(message(error, 'No se pudo guardar el nombre'))
    } finally {
      setProfileBusy(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    setPasswordBusy(true)
    setPasswordError(null)
    try {
      await auth.changePassword(currentPassword, newPassword)
      haptic('success')
      notify('Contraseña actualizada. Las otras sesiones se han cerrado.')
      setShowPassword(false)
      setCurrentPassword('')
      setNewPassword('')
    } catch (error) {
      setPasswordError(message(error, 'No se pudo cambiar la contraseña'))
    } finally {
      setPasswordBusy(false)
    }
  }

  const destroyAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await auth.deleteAccount(deletePassword)
      haptic('error')
      onClose()
    } catch (error) {
      setDeleteError(message(error, 'No se pudo eliminar la cuenta'))
    } finally {
      setDeleteBusy(false)
    }
  }

  const closeSession = async () => {
    haptic('light')
    onClose()
    await auth.logout()
  }

  const closeAllSessions = async () => {
    haptic('light')
    onClose()
    try {
      await auth.logoutAll()
    } catch {
      /* si el token ya no valía, la sesión local también se ha cerrado */
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="settings__scrim" onClick={onClose} aria-hidden="true" />
          <m.div
            className="settings"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Cuenta y ajustes"
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 520, damping: 38 }}
          >
            <header className="settings__head">
              <h2>Tu cuenta</h2>
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                onClick={onClose}
                aria-label="Cerrar cuenta y ajustes"
              >
                <X size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>

            <section className="settings__section settings__account">
              <span className="settings__avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <div className="settings__identity">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <span className="settings__secure">
                <ShieldCheck size={13} strokeWidth={1.8} aria-hidden="true" />
                Cuenta
              </span>
            </section>

            <section className="settings__section">
              <p className="settings__label">Perfil</p>
              <form className="settings__inline" onSubmit={saveName}>
                <input
                  className="settings__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Tu nombre"
                  maxLength={60}
                  placeholder="Tu nombre"
                />
                <button
                  type="submit"
                  className="btn btn--ghost btn--sm"
                  disabled={profileBusy || !name.trim() || name.trim() === user.name}
                >
                  {profileBusy ? '…' : 'Guardar'}
                </button>
              </form>
              {profileError && <p className="settings__error">{profileError}</p>}
            </section>

            <section className="settings__section">
              <p className="settings__label">Tema</p>
              <div className="themepick" role="group" aria-label="Tema de la interfaz">
                <button
                  type="button"
                  className={`themepick__btn ${theme === 'paper' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTheme('paper')
                    haptic('selection')
                  }}
                  aria-pressed={theme === 'paper'}
                >
                  <span className="themepick__swatch themepick__swatch--paper">
                    <i />
                    <i />
                  </span>
                  <span className="themepick__name">
                    <Sun size={13} strokeWidth={1.8} aria-hidden="true" /> Papel
                  </span>
                  {theme === 'paper' && <Check size={14} strokeWidth={2.2} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className={`themepick__btn ${theme === 'night' ? 'is-active' : ''}`}
                  onClick={() => {
                    setTheme('night')
                    haptic('selection')
                  }}
                  aria-pressed={theme === 'night'}
                >
                  <span className="themepick__swatch themepick__swatch--night">
                    <i />
                    <i />
                  </span>
                  <span className="themepick__name">
                    <Moon size={13} strokeWidth={1.8} aria-hidden="true" /> Noche
                  </span>
                  {theme === 'night' && <Check size={14} strokeWidth={2.2} aria-hidden="true" />}
                </button>
              </div>
            </section>

            <section className="settings__section">
              <div className="settings__row">
                <div>
                  <p className="settings__title">Respuesta háptica</p>
                  <p className="settings__copy">Vibra al abrir, mover y completar.</p>
                </div>
                <Switch checked={hapticsEnabled} onChange={setHaptics} label="Activar hápticas" />
              </div>
              <div className="haptic-tests" role="group" aria-label="Probar patrones hápticos">
                {TESTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="haptic-tests__btn"
                    disabled={!hapticsEnabled}
                    onClick={() => test(item.id, item.label)}
                  >
                    <Zap size={11} strokeWidth={2} aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="settings__note" aria-live="polite">
                {!hapticsEnabled
                  ? 'Hápticas desactivadas.'
                  : tested
                    ? `Patrón «${tested}» enviado.`
                    : HAPTIC_SUPPORTED
                      ? 'En móvil compatible notarás la vibración. En escritorio no hay motor háptico.'
                      : 'Este navegador no expone vibración. Pruébalo en el móvil.'}
              </p>
            </section>

            <section className="settings__section">
              <p className="settings__label">Atajos</p>
              <ul className="shortcuts">
                <li>
                  <span>Buscar o navegar</span>
                  <span className="shortcuts__keys">
                    <kbd className="kbd">⌘</kbd>
                    <kbd className="kbd">K</kbd>
                  </span>
                </li>
                <li>
                  <span>Nuevo evento</span>
                  <kbd className="kbd">N</kbd>
                </li>
                <li>
                  <span>Cambiar semana</span>
                  <span className="shortcuts__keys">
                    <kbd className="kbd">←</kbd>
                    <kbd className="kbd">→</kbd>
                  </span>
                </li>
                <li>
                  <span>Mover un evento</span>
                  <span className="shortcut-note">Mantén + arrastra</span>
                </li>
                <li>
                  <span>Cerrar una capa</span>
                  <kbd className="kbd">Esc</kbd>
                </li>
              </ul>
            </section>

            <section className="settings__section">
              <p className="settings__label">Sesión</p>
              <button type="button" className="settings__action" onClick={() => void closeSession()}>
                <LogOut size={15} strokeWidth={1.8} aria-hidden="true" />
                Cerrar sesión
              </button>
              <button
                type="button"
                className="settings__action settings__action--muted"
                onClick={() => void closeAllSessions()}
              >
                Cerrar en todos los dispositivos
              </button>
              <button
                type="button"
                className="settings__action settings__action--muted"
                onClick={() => setShowPassword((value) => !value)}
              >
                <KeyRound size={14} strokeWidth={1.8} aria-hidden="true" />
                {showPassword ? 'Ocultar cambio de contraseña' : 'Cambiar contraseña'}
              </button>

              {showPassword && (
                <form className="settings__password" onSubmit={savePassword}>
                  <label className="settings__field">
                    <span>Contraseña actual</span>
                    <input
                      type="password"
                      className="settings__input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label className="settings__field">
                    <span>Nueva contraseña</span>
                    <input
                      type="password"
                      className="settings__input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  </label>
                  {passwordError && <p className="settings__error">{passwordError}</p>}
                  <p className="settings__hint">
                    Al cambiarla se cerrarán las sesiones de los demás dispositivos.
                  </p>
                  <button type="submit" className="btn btn--primary btn--sm" disabled={passwordBusy}>
                    {passwordBusy ? 'Guardando…' : 'Actualizar contraseña'}
                  </button>
                </form>
              )}
            </section>

            <section className="settings__section settings__danger">
              {!confirmDelete ? (
                <button
                  type="button"
                  className="settings__action settings__action--danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                  Eliminar mi cuenta
                </button>
              ) : (
                <form className="settings__password" onSubmit={destroyAccount}>
                  <p className="settings__warning">
                    Se borrarán tu cuenta, tus eventos, tareas y sesiones. No se puede
                    deshacer.
                  </p>
                  <label className="settings__field">
                    <span>Confirma con tu contraseña</span>
                    <input
                      type="password"
                      className="settings__input"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  {deleteError && <p className="settings__error">{deleteError}</p>}
                  <div className="settings__dangerrow">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        setConfirmDelete(false)
                        setDeletePassword('')
                        setDeleteError(null)
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="settings__delete"
                      disabled={deleteBusy || !deletePassword}
                    >
                      {deleteBusy ? 'Eliminando…' : 'Eliminar para siempre'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <footer className="settings__foot">
              <span className="settings__brandmark" aria-hidden="true">
                ◍
              </span>
              Pulso · Postgres · v1.0
              <span className="settings__version">/api</span>
            </footer>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
