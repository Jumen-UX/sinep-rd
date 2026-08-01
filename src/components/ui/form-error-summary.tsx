'use client'

import * as React from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export type FormErrorSummaryItem = {
  fieldId: string
  label: string
  message: string
}

type FormErrorSummaryProps = {
  errors: FormErrorSummaryItem[]
  title?: string
  autoFocus?: boolean
  className?: string
}

function focusInvalidField(fieldId: string) {
  const field = document.getElementById(fieldId)
  if (!(field instanceof HTMLElement)) return

  field.focus({ preventScroll: true })
  field.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function FormErrorSummary({
  errors,
  title,
  autoFocus = true,
  className,
}: FormErrorSummaryProps) {
  const summaryRef = React.useRef<HTMLElement>(null)
  const errorSignature = errors.map((error) => `${error.fieldId}:${error.message}`).join('|')

  React.useEffect(() => {
    if (autoFocus && errors.length > 0) summaryRef.current?.focus()
  }, [autoFocus, errorSignature, errors.length])

  if (errors.length === 0) return null

  const resolvedTitle = title
    ?? (errors.length === 1
      ? 'Revisa el campo indicado'
      : `Revisa los ${errors.length} campos indicados`)

  return (
    <Alert
      ref={summaryRef}
      announce="assertive"
      className={className}
      tabIndex={-1}
      tone="danger"
      title={resolvedTitle}
    >
      <p>Conservamos los datos válidos. Corrige lo siguiente para continuar:</p>
      <ul className="mt-2 grid gap-1">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <Button
              className="h-auto justify-start whitespace-normal p-0 text-left"
              onClick={() => focusInvalidField(error.fieldId)}
              variant="link"
            >
              <span className="font-semibold">{error.label}:</span> {error.message}
            </Button>
          </li>
        ))}
      </ul>
    </Alert>
  )
}

export { FormErrorSummary, type FormErrorSummaryProps }
