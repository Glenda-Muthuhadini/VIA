import { type HTMLAttributes } from 'react'
import { classNames } from '../../../utils/classNames'

type StatusBadgeTone = 'success' | 'info' | 'warning' | 'error' | 'neutral'

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusBadgeTone
}

export function StatusBadge({
  className,
  tone = 'neutral',
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={classNames('via-badge', `via-badge-${tone}`, className)}
      {...props}
    />
  )
}
