'use client'

import { useState } from 'react'
import styles from './PasswordSecurity.module.css'

type PasswordInputProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  describedBy: string
  invalid: boolean
  minLength: number
  disabled?: boolean
}

function VisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.7 10.7 0 0112 4c5.2 0 8.5 4.1 9.5 6a3.8 3.8 0 010 4c-.5.9-1.5 2.3-3 3.5M6.6 6.6C4.5 8 3.2 10 2.5 11.3a3.8 3.8 0 000 3.4C3.5 16.6 6.8 20 12 20c1.2 0 2.3-.2 3.3-.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M2.5 10.2a3.8 3.8 0 000 3.6C3.5 15.8 6.8 20 12 20s8.5-4.2 9.5-6.2a3.8 3.8 0 000-3.6C20.5 8.2 17.2 4 12 4S3.5 8.2 2.5 10.2z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  describedBy,
  invalid,
  minLength,
  disabled = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const actionLabel = visible ? 'Ocultar' : 'Mostrar'

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputShell}>
        <input
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete="new-password"
          disabled={disabled}
          id={id}
          minLength={minLength}
          required
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-controls={id}
          aria-label={`${actionLabel} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className={styles.visibilityToggle}
          disabled={disabled}
          type="button"
          onClick={() => setVisible((current) => !current)}
        >
          <VisibilityIcon visible={visible} />
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  )
}
