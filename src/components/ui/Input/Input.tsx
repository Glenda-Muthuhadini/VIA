import {
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from 'react'
import { classNames } from '../../../utils/classNames'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  action?: ReactNode
  error?: string
  helperText?: string
  icon?: ReactNode
  label?: string
}

export function Input({
  action,
  className,
  error,
  helperText,
  icon,
  id,
  label,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`

  return (
    <label className="via-field">
      {label ? <span className="via-field-label">{label}</span> : null}
      <span className="via-input-shell">
        {icon ? <span className="via-input-icon-slot">{icon}</span> : null}
        <input
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          aria-invalid={error ? true : undefined}
          className={classNames(
            'via-input-base via-focus-ring',
            Boolean(icon) && 'via-input-has-icon',
            Boolean(action) && 'via-input-has-action',
            className,
          )}
          id={inputId}
          {...props}
        />
        {action ? <span className="via-input-action">{action}</span> : null}
      </span>
      {helperText ? (
        <span className="via-field-helper" id={helperId}>
          {helperText}
        </span>
      ) : null}
      {error ? (
        <span className="via-field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  )
}
