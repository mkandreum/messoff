import type { ReactNode } from 'react'
import { CATEGORY_LABEL } from '../data'
import type { Category } from '../types'
import { haptic } from '../lib/haptics'

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => {
        haptic('selection')
        onChange(!checked)
      }}
    >
      <span className="switch__knob" />
    </button>
  )
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  if (!names.length) return null
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <span className="avatars" aria-label={`Asistentes: ${names.join(', ')}`}>
      {shown.map((name) => (
        <span className="avatar" key={name} title={name}>
          {initials(name)}
        </span>
      ))}
      {rest > 0 && <span className="avatar avatar--rest">+{rest}</span>}
    </span>
  )
}

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className={`cat-tag cat-tag--${category}`}>
      <i aria-hidden="true" />
      {CATEGORY_LABEL[category]}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="logo-mark"
    >
      <circle cx="16" cy="16" r="12.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="2.4" fill="var(--accent)" />
      <path d="M16 0.8V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 27v4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
