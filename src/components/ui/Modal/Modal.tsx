import { type ReactNode } from 'react'
import { GlassCard } from '../GlassCard'

type ModalProps = {
  children: ReactNode
  isOpen: boolean
  title: string
}

export function Modal({ children, isOpen, title }: ModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(7,24,33,0.38)] p-6"
      role="dialog"
    >
      <GlassCard className="w-full max-w-lg rounded-[var(--radius-xl)] p-6">
        <h2 className="via-type-section-title">{title}</h2>
        <div className="mt-4">{children}</div>
      </GlassCard>
    </div>
  )
}
