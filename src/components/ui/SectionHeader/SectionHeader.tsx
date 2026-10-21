type SectionHeaderProps = {
  subtitle?: string
  title: string
}

export function SectionHeader({ subtitle, title }: SectionHeaderProps) {
  return (
    <header>
      <h2 className="via-type-section-title">{title}</h2>
      {subtitle ? (
        <p className="via-type-body via-type-muted mt-2">{subtitle}</p>
      ) : null}
    </header>
  )
}
