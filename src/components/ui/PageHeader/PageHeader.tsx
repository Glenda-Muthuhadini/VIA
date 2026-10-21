import { type ReactNode } from 'react'

type PageHeaderProps = {
  actions?: ReactNode
  eyebrow?: string
  subtitle?: string
  title: string
}

export function PageHeader({ actions, eyebrow, subtitle, title }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div>
        {eyebrow ? (
          <p className="via-type-label text-[color:var(--via-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="via-type-page-title">{title}</h1>
        {subtitle ? (
          <p className="via-type-body via-type-muted mt-2">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  )
}
