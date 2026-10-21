import { type SelectHTMLAttributes, useId } from 'react'
import { classNames } from '../../../utils/classNames'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string
  helperText?: string
  label?: string
}

export function Select({
  children,
  className,
  error,
  helperText,
  id,
  label,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <label className="via-field">
      {label ? <span className="via-field-label">{label}</span> : null}
      <select
        aria-invalid={error ? true : undefined}
        className={classNames(
          'via-input-base via-focus-ring px-4',
          className,
        )}
        id={selectId}
        {...props}
      >
        {children}
      </select>
      {helperText ? <span className="via-field-helper">{helperText}</span> : null}
      {error ? <span className="via-field-error">{error}</span> : null}
    </label>
  )
}
