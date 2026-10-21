import { type InputHTMLAttributes, type ReactNode, useId } from 'react'
import { classNames } from '../../../utils/classNames'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode
}

export function Checkbox({ className, id, label, ...props }: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  return (
    <label className={classNames('flex items-start gap-3', className)}>
      <input
        className="via-checkbox-control via-focus-ring mt-0.5"
        id={checkboxId}
        type="checkbox"
        {...props}
      />
      <span>{label}</span>
    </label>
  )
}
