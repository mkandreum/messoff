import type { CalEvent, Team, TeamColor } from '../types'

export const TEAM_COLORS: TeamColor[] = ['rojo', 'verde', 'azul', 'ocre', 'violeta', 'grafito']

export const TEAM_COLOR_LABEL: Record<TeamColor, string> = {
  rojo: 'Bermellón',
  verde: 'Verde',
  azul: 'Azul',
  ocre: 'Ocre',
  violeta: 'Violeta',
  grafito: 'Grafito',
}

// [papel, noche]
const HEX: Record<TeamColor, [string, string]> = {
  rojo: ['#c9431f', '#ff7a4d'],
  verde: ['#3f6b52', '#8dba99'],
  azul: ['#2f6480', '#85b8d2'],
  ocre: ['#996a12', '#dcb060'],
  violeta: ['#6b4f96', '#b79ae0'],
  grafito: ['#4a463d', '#c4bca8'],
}

export const teamHex = (color: TeamColor | undefined, night: boolean) =>
  (HEX[color ?? 'azul'] ?? HEX.azul)[night ? 1 : 0]

/** Id del calendario de un evento: 'me' o el id del equipo. */
export const calendarOf = (event: Pick<CalEvent, 'teamId'>) => event.teamId ?? 'me'

export const teamById = (teams: Team[], id: string | null | undefined) =>
  id ? teams.find((team) => team.id === id) : undefined

/** Enlace para unirse a un equipo: lo abre quien no tiene cuenta y se registra. */
export const joinLink = (code: string) => `${window.location.origin}/?join=${encodeURIComponent(code)}`
