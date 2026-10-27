import { teamHex } from '../lib/teams'
import { haptic } from '../lib/haptics'
import { usePlanner } from '../state'

type Props = {
  value: string | null
  onChange: (teamId: string | null) => void
  disabled?: boolean
}

/** Elige dónde vive un evento: en tu calendario o en el de un equipo. */
export function CalendarPicker({ value, onChange, disabled }: Props) {
  const { teams, theme } = usePlanner()
  if (teams.length === 0) return null
  const options = [
    { id: null as string | null, name: 'Solo para mí', color: undefined as string | undefined },
    ...teams.map((team) => ({ id: team.id as string | null, name: team.name, color: teamHex(team.color, theme === 'night') })),
  ]
  return (
    <div className="calpick" role="group" aria-label="Calendario del evento">
      {options.map((option) => (
        <button
          key={option.id ?? 'me'}
          type="button"
          disabled={disabled}
          className={`calpick__btn ${value === option.id ? 'is-active' : ''}`}
          style={option.color ? { ['--c' as string]: option.color } : undefined}
          aria-pressed={value === option.id}
          onClick={() => {
            haptic('selection')
            onChange(option.id)
          }}
        >
          <i aria-hidden="true" />
          {option.name}
        </button>
      ))}
    </div>
  )
}
