import { type ReactNode } from 'react'
import { classNames } from '../../../utils/classNames'

type ToastTone = 'success' | 'info' | 'warning' | 'error'

type ToastProps = {
  children: ReactNode
  tone?: ToastTone
}

export function Toast({ children, tone = 'info' }: ToastProps) {
  return (
    <div
      className={classNames(
        'rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold shadow-[var(--shadow-md)]',
        tone === 'success' && 'bg-[var(--via-success-soft)] text-[var(--via-success)]',
        tone === 'info' && 'bg-[var(--via-info-soft)] text-[var(--via-info)]',
        tone === 'warning' && 'bg-[var(--via-warning-soft)] text-[var(--via-warning)]',
        tone === 'error' && 'bg-[var(--via-danger-soft)] text-[var(--via-danger)]',
      )}
      role="status"
    >
      {children}
    </div>
  )
}
