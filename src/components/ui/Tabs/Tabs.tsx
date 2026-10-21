import { type ReactNode } from 'react'
import { classNames } from '../../../utils/classNames'

type TabItem = {
  id: string
  label: string
}

type TabsProps = {
  activeId: string
  items: TabItem[]
  onChange: (id: string) => void
}

export function Tabs({ activeId, items, onChange }: TabsProps) {
  return (
    <div className="inline-flex rounded-[var(--radius-pill)] bg-[var(--via-surface-soft)] p-1">
      {items.map((item) => (
        <button
          className={classNames(
            'via-focus-ring rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold transition',
            item.id === activeId
              ? 'bg-[var(--via-surface)] text-[var(--via-primary-dark)] shadow-[var(--shadow-sm)]'
              : 'text-[var(--via-text-secondary)] hover:text-[var(--via-primary-dark)]',
          )}
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export type TabsContentProps = {
  children: ReactNode
}
