import { WebHaptics } from 'web-haptics'
import type { HapticKind } from '../types'

let engine: WebHaptics | null = null
let enabled = true

export const HAPTIC_SUPPORTED =
  typeof navigator !== 'undefined' &&
  (typeof navigator.vibrate === 'function' || WebHaptics.isSupported)

export function setHapticsEnabled(next: boolean) {
  enabled = next
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
}

/** Fires a haptic pattern. Safe to call anywhere: silently no-ops without support. */
export function haptic(kind: HapticKind = 'light') {
  if (!enabled) return
  try {
    if (!engine) engine = new WebHaptics({ debug: false })
    void engine.trigger(kind)
  } catch {
    try {
      navigator.vibrate?.(FALLBACK[kind])
    } catch {
      /* no haptics available */
    }
  }
}
