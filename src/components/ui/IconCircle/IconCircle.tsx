import { type HTMLAttributes, type ReactNode } from 'react'
import { classNames } from '../../../utils/classNames'

type IconTone = 'brand' | 'success' | 'info' | 'warning' | 'danger' | 'neutral'
type IconSize = 'small' | 'medium' | 'large'

type IconCircleProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  size?: IconSize
  tone?: IconTone
}

export function IconCircle({
  children,
  className,
  size = 'medium',
  tone = 'brand',
  ...props
}: IconCircleProps) {
  return (
    <span
      className={classNames(
        'via-icon-circle',
        `via-icon-circle-${size}`,
        `via-icon-circle-${tone}`,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
