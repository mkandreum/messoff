import { WebHaptics, type HapticPreset } from 'web-haptics'
import type { HapticKind } from '../types'

let engine: WebHaptics | null = null
let enabled = true
let lastTick = 0

export const HAPTIC_SUPPORTED =
  typeof navigator !== 'undefined' &&
  (typeof navigator.vibrate === 'function' || WebHaptics.isSupported)

export function setHapticsEnabled(next: boolean) {
  enabled = next
}

/** Patrones propios: el lenguaje táctil de Pulso. */
const CUSTOM: Partial<Record<HapticKind, HapticPreset>> = {
  // Cruce de franja al arrastrar: un clic seco, casi mecánico.
  tick: { pattern: [{ duration: 6, intensity: 0.45 }] },
  // Soltar en su sitio: peso y asentamiento.
  snap: {
    pattern: [
      { duration: 22, intensity: 0.9 },
      { delay: 36, duration: 12, intensity: 0.4 },
    ],
  },
  // Umbral de deslizar superado.
  swipe: { pattern: [{ duration: 14, intensity: 0.7 }] },
  // La firma de la marca: dos latidos.
  heartbeat: {
    pattern: [
      { duration: 18, intensity: 0.8 },
      { delay: 90, duration: 28, intensity: 1 },
    ],
  },
  // Cerrar algo grande: foco completado, bandeja vacía.
  celebrate: {
    pattern: [
      { duration: 16, intensity: 0.5 },
      { delay: 50, duration: 16, intensity: 0.7 },
      { delay: 50, duration: 40, intensity: 1 },
    ],
  },
}

const FALLBACK: Record<HapticKind, number | number[]> = {
  selection: 8,
  light: 15,
  medium: 25,
  heavy: 35,
  success: [18, 60, 26],
  warning: [30, 90, 30],
  error: [30, 60, 30, 60, 30],
  nudge: [70, 70, 45],
  soft: 40,
  rigid: 10,
  tick: 6,
  snap: [22, 36, 12],
  swipe: 14,
  heartbeat: [18, 90, 28],
  celebrate: [16, 50, 16, 50, 40],
}

/** Dispara un patrón háptico. Seguro en cualquier sitio: sin soporte, no hace nada. */
export function haptic(kind: HapticKind = 'light') {
  if (!enabled) return
  try {
    if (!engine) engine = new WebHaptics({ debug: false })
    void engine.trigger(CUSTOM[kind] ?? kind)
  } catch {
    try {
      navigator.vibrate?.(FALLBACK[kind])
    } catch {
      /* sin hápticas disponibles */
    }
  }
}

/** Tic limitado a uno cada 40 ms: para gestos continuos como arrastrar. */
export function hapticTick() {
  const now = performance.now()
  if (now - lastTick < 40) return
  lastTick = now
  haptic('tick')
}
