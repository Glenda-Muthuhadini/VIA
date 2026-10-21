type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Loading...' }: LoadingStateProps) {
  return (
    <div
      aria-live="polite"
      className="flex items-center justify-center gap-3 text-[color:var(--via-text-secondary)]"
      role="status"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--via-border)] border-t-[var(--via-primary)]" />
      <span className="via-type-label">{label}</span>
    </div>
  )
}
