import { type HTMLAttributes } from 'react'
import { classNames } from '../../../utils/classNames'

type ProgressBarProps = HTMLAttributes<HTMLDivElement> & {
  value: number
}

export function ProgressBar({ className, value, ...props }: ProgressBarProps) {
  const safeValue = Math.min(100, Math.max(0, value))

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={classNames('via-progress', className)}
      role="progressbar"
      {...props}
    >
      <div className="via-progress-bar" style={{ width: `${safeValue}%` }} />
    </div>
  )
}
