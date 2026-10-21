import {
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { classNames } from '../../../utils/classNames'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'small' | 'medium' | 'large'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  isLoading?: boolean
  loadingLabel?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  size?: ButtonSize
  variant?: ButtonVariant
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  loadingLabel = 'Loading...',
  leftIcon,
  rightIcon,
  size = 'medium',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames(
        'via-button via-focus-ring',
        `via-button-${variant}`,
        `via-button-${size}`,
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? loadingLabel : leftIcon}
      {isLoading ? null : children}
      {isLoading ? null : rightIcon}
    </button>
  )
}
