// Microsoft-style initials avatar — deterministic color per user name.
// Falls back gracefully if name is empty.

const PALETTE = [
  '#2E334E', // navy
  '#0078D4', // MS blue
  '#007A4C', // forest green
  '#5C6BC0', // indigo
  '#8764B8', // purple
  '#B4009E', // magenta
  '#744DA9', // violet
  '#0099BC', // teal-blue
  '#498205', // olive green
  '#8E562E', // brown
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]![0] ?? '?').toUpperCase()
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase()
}

function getColor(name: string): string {
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return PALETTE[hash % PALETTE.length] ?? '#0078D4'
}

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name)
  const bg = getColor(name)
  const sizeClass = SIZE_CLASSES[size]

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white/30 select-none ${className}`}
      style={{ backgroundColor: bg }}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  )
}
