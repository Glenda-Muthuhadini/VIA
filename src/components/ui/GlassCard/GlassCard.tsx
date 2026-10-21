import { type HTMLAttributes } from 'react'
import { classNames } from '../../../utils/classNames'

type GlassCardVariant = 'light' | 'default' | 'strong'

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: GlassCardVariant
}

export function GlassCard({
  className,
  variant = 'default',
  ...props
}: GlassCardProps) {
  return (
    <div
      className={classNames('via-glass', `via-glass-${variant}`, className)}
      {...props}
    />
  )
}
