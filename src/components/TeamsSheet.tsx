import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import {
  Check,
  ChevronLeft,
  Copy,
  Link2,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import type { Invitation, Team, TeamColor } from '../types'
import { TEAM_COLORS, TEAM_COLOR_LABEL, joinLink, teamHex } from '../lib/teams'
import { haptic } from '../lib/haptics'
import { useBodyLock, useFocusTrap } from '../lib/focus'
import { usePlanner } from '../state'
import { initials } from './ui'

type Props = { open: boolean; onClose: () => void; initialCode?: string | null }

function ColorPicker({ value, onChange }: { value: TeamColor; onChange: (color: TeamColor) => void }) {
  const { theme } = usePlanner()
  return (
    <div className="colorpick" role="group" aria-label="Color del equipo">
      {TEAM_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`colorpick__btn ${value === color ? 'is-active' : ''}`}
          style={{ ['--c' as string]: teamHex(color, theme === 'night') }}
          onClick={() => {
            haptic('selection')
            onChange(color)
          }}
          aria-label={TEAM_COLOR_LABEL[color]}
          aria-pressed={value === color}
          title={TEAM_COLOR_LABEL[color]}
        >
          {value === color && <Check size={13} strokeWidth={3} aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}

function InvitationCard({ invitation }: { invitation: Invitation }) {
  const { acceptInvitation, declineInvitation, notify, theme } = usePlanner()
  const [busy, setBusy] = useState(false)
  return (
    <div className="teaminvite" style={{ ['--c' as string]: teamHex(invitation.color, theme === 'night') }}>
      <span className="teaminvite__dot" aria-hidden="true" />
      <div className="teaminvite__text">
        <strong>{invitation.teamName}</strong>
        <span>{invitation.invitedBy} te ha invitado</span>
      </div>
      <button
        type="button"
        className="btn btn--ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          haptic('light')
          await declineInvitation(invitation.id)
          setBusy(false)
        }}
      >
        Rechazar
      </button>
      <button
        type="button"
        className="btn btn--primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await acceptInvitation(invitation.id)
          haptic('success')
          notify(`Ya formas parte de «${invitation.teamName}»`)
          setBusy(false)
        }}
      >
        Aceptar
      </button>
    </div>
  )
}

function TeamDetail({ team, onBack }: { team: Team; onBack: () => void }) {
  const {
    user,
    theme,
    updateTeam,
    deleteTeam,
    regenerateCode,
    inviteToTeam,
    removeInvite,
    leaveTeam,
    notify,
  } = usePlanner()
  const [name, setName] = useState(team.name)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const owner = team.role === 'owner'
  const link = joinLink(team.joinCode)

  useEffect(() => setName(team.name), [team.name])

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      haptic('success')
      notify(message)
    } catch {
      notify('No se pudo copiar. Selecciona el texto y cópialo a mano.')
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Únete a ${team.name} en MessOff`, url: link })
        return
      } catch {
        /* cancelado: probamos a copiar */
      }
    }
    await copy(link, 'Enlace copiado. Quien lo abra podrá crear su cuenta y unirse.')
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value) return
    setBusy(true)
    const result = await inviteToTeam(team.id, value)
    setBusy(false)
    if (!result) return
    setEmail('')
    haptic('success')
    notify(
      result.registered
        ? 'Invitación enviada: la verá al abrir MessOff.'
        : 'Invitación guardada. Cuando se registre con ese email, la verá. También puedes mandarle el enlace.',
    )
  }

  return (
    <m.div
      className="teamdetail"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
      style={{ ['--c' as string]: teamHex(team.color, theme === 'night') }}
    >
      <button type="button" className="teams__back" onClick={onBack}>
        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" /> Equipos
      </button>

      <header className="teamdetail__head">
        <span className="teamdetail__badge" aria-hidden="true">
          {initials(team.name)}
        </span>
        {owner ? (
          <input
            className="teamdetail__name"
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.replace(/\s+/g, ' ').trim()
              if (next && next !== team.name) void updateTeam(team.id, { name: next })
              else setName(team.name)
            }}
            aria-label="Nombre del equipo"
          />
        ) : (
          <h3 className="teamdetail__name teamdetail__name--static">{team.name}</h3>
        )}
      </header>

      {owner && <ColorPicker value={team.color} onChange={(color) => void updateTeam(team.id, { color })} />}

      <section className="teamsec">
        <h4 className="teamsec__title">
          <Users size={14} strokeWidth={1.8} aria-hidden="true" /> Personas <em>{team.members.length}</em>
        </h4>
        <ul className="members">
          {team.members.map((member) => (
            <li key={member.id}>
              <span className="members__avatar">{initials(member.name)}</span>
              <span className="members__text">
                <strong>
                  {member.name}
                  {member.id === user.id && <i> (tú)</i>}
                </strong>
                <span>{member.email}</span>
              </span>
              {member.role === 'owner' && <span className="members__tag">Admin</span>}
              {owner && member.role !== 'owner' && (
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label={`Quitar a ${member.name}`}
                  onClick={async () => {
                    haptic('warning')
                    await leaveTeam(team.id, member.id)
                  }}
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
          {team.invites.map((invite) => (
            <li key={invite.id} className="members__pending">
              <span className="members__avatar members__avatar--ghost">
                <Mail size={14} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="members__text">
                <strong>{invite.email}</strong>
                <span>Pendiente · aún no ha aceptado</span>
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                aria-label={`Cancelar invitación a ${invite.email}`}
                onClick={() => void removeInvite(team.id, invite.id)}
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {owner && (
        <section className="teamsec">
          <h4 className="teamsec__title">
            <UserPlus size={14} strokeWidth={1.8} aria-hidden="true" /> Invitar
          </h4>
          <form className="teamform" onSubmit={invite}>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email de la persona a invitar"
            />
            <button type="submit" className="btn btn--primary" disabled={busy || !email.trim()}>
              Invitar
            </button>
          </form>
          <p className="teamsec__hint">
            Vale para personas con y sin cuenta: si todavía no se han registrado, la invitación espera a que lo hagan.
          </p>
        </section>
      )}

      <section className="teamsec">
        <h4 className="teamsec__title">
          <Link2 size={14} strokeWidth={1.8} aria-hidden="true" /> Enlace para unirse
        </h4>
        <div className="linkbox">
          <code>{link}</code>
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => void copy(link, 'Enlace copiado')} aria-label="Copiar enlace">
            <Copy size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="teamform teamform--row">
          <button type="button" className="btn btn--primary" onClick={() => void share()}>
            Compartir enlace
          </button>
          {owner && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={async () => {
                haptic('warning')
                await regenerateCode(team.id)
                notify('Enlace renovado: el anterior ya no funciona.')
              }}
            >
              <RefreshCw size={14} strokeWidth={1.8} aria-hidden="true" /> Renovar
            </button>
          )}
        </div>
        <p className="teamsec__hint">Quien abra el enlace, cree su cuenta (o entre) y se una verá y podrá editar el calendario del equipo.</p>
      </section>

      <footer className="teamdetail__foot">
        {owner ? (
          confirmDelete ? (
            <>
              <span className="teamsec__hint">Los eventos del equipo vuelven al calendario de quien los creó.</span>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={async () => {
                  haptic('error')
                  await deleteTeam(team.id)
                  onBack()
                }}
              >
                Eliminar equipo
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" /> Eliminar equipo
            </button>
          )
        ) : (
          <button
            type="button"
            className="btn btn--danger-ghost"
            onClick={async () => {
              haptic('warning')
              await leaveTeam(team.id, user.id)
              onBack()
            }}
          >
            <LogOut size={15} strokeWidth={1.8} aria-hidden="true" /> Salir del equipo
          </button>
        )}
      </footer>
    </m.div>
  )
}

export function TeamsSheet({ open, onClose, initialCode }: Props) {
  const { teams, invitations, theme, createTeam, joinTeam, notify } = usePlanner()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<TeamColor>('azul')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  useFocusTrap(panel, open, onClose)
  useBodyLock(open)

  useEffect(() => {
    if (!open) return
    setSelectedId(null)
    setCreating(false)
    setName('')
    setCode(initialCode ?? '')
  }, [open, initialCode])

  const selected = teams.find((team) => team.id === selectedId)
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null)
  }, [selected, selectedId])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = name.replace(/\s+/g, ' ').trim()
    if (!title) return
    setBusy(true)
    const id = await createTeam(title, color)
    setBusy(false)
    if (!id) return
    haptic('success')
    setName('')
    setCreating(false)
    setSelectedId(id)
  }

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = code.trim().replace(/^.*join=/, '')
    if (!value) return
    setBusy(true)
    const team = await joinTeam(value)
    setBusy(false)
    if (!team) return
    haptic('success')
    notify(`Ya formas parte de «${team.name}»`)
    setCode('')
    setSelectedId(team.id)
  }

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <m.div
            ref={panel}
            className="teams"
            role="dialog"
            aria-modal="true"
            aria-label="Equipos"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
          >
            <header className="teams__bar">
              <div>
                <p className="kicker">CALENDARIOS COMPARTIDOS</p>
                <h2 className="teams__title">
                  Tus <em>equipos</em>
                </h2>
              </div>
              <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Cerrar">
                <X size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>

            <div className="teams__scroll">
              <AnimatePresence mode="wait" initial={false}>
                {selected ? (
                  <TeamDetail key={selected.id} team={selected} onBack={() => setSelectedId(null)} />
                ) : (
                  <m.div
                    key="list"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  >
                    {invitations.length > 0 && (
                      <section className="teamsec">
                        <h4 className="teamsec__title">Invitaciones</h4>
                        {invitations.map((invitation) => (
                          <InvitationCard key={invitation.id} invitation={invitation} />
                        ))}
                      </section>
                    )}

                    <section className="teamsec">
                      {teams.length === 0 && !creating && (
                        <div className="empty">
                          <span className="empty__mark" aria-hidden="true">
                            ✳
                          </span>
                          <p className="empty__title">Todavía no tienes equipos.</p>
                          <p className="empty__copy">
                            Crea uno e invita a quien quieras: compartiréis un calendario, aunque aún no tengan cuenta.
                          </p>
                        </div>
                      )}
                      <ul className="teamlist">
                        {teams.map((team) => (
                          <li key={team.id}>
                            <button
                              type="button"
                              className="teamrow"
                              style={{ ['--c' as string]: teamHex(team.color, theme === 'night') }}
                              onClick={() => {
                                haptic('selection')
                                setSelectedId(team.id)
                              }}
                            >
                              <span className="teamrow__badge" aria-hidden="true">
                                {initials(team.name)}
                              </span>
                              <span className="teamrow__text">
                                <strong>{team.name}</strong>
                                <span>
                                  {team.members.length} {team.members.length === 1 ? 'persona' : 'personas'}
                                  {team.invites.length > 0 && ` · ${team.invites.length} pendiente${team.invites.length === 1 ? '' : 's'}`}
                                  {team.role === 'owner' ? ' · Admin' : ''}
                                </span>
                              </span>
                              <ChevronLeft className="teamrow__arrow" size={16} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>

                      {creating ? (
                        <form className="teamnew" onSubmit={create}>
                          <input
                            autoFocus
                            value={name}
                            maxLength={50}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nombre del equipo (Diseño, Familia, Club…)"
                            aria-label="Nombre del equipo"
                          />
                          <ColorPicker value={color} onChange={setColor} />
                          <div className="teamform teamform--row">
                            <button type="button" className="btn btn--ghost" onClick={() => setCreating(false)}>
                              Cancelar
                            </button>
                            <button type="submit" className="btn btn--primary" disabled={busy || !name.trim()}>
                              Crear equipo
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="teamadd"
                          onClick={() => {
                            haptic('selection')
                            setCreating(true)
                          }}
                        >
                          <Plus size={16} strokeWidth={2} aria-hidden="true" /> Crear un equipo
                        </button>
                      )}
                    </section>

                    <section className="teamsec">
                      <h4 className="teamsec__title">¿Tienes un código o un enlace?</h4>
                      <form className="teamform" onSubmit={join}>
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="Pega aquí el código o el enlace"
                          aria-label="Código del equipo"
                        />
                        <button type="submit" className="btn btn--ghost" disabled={busy || !code.trim()}>
                          Unirme
                        </button>
                      </form>
                    </section>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
