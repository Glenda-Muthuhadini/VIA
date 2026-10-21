import { type ReactNode } from 'react'

type EmptyStateProps = {
  action?: ReactNode
  description?: string
  icon?: ReactNode
  title: string
}

export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <div className="grid place-items-center rounded-[var(--radius-lg)] border border-[var(--via-border)] bg-[var(--via-surface)] p-8 text-center shadow-[var(--shadow-sm)]">
      {icon ? <div className="mb-4">{icon}</div> : null}
      <h2 className="via-type-card-title">{title}</h2>
      {description ? (
        <p className="via-type-body via-type-muted mt-2 max-w-md">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
