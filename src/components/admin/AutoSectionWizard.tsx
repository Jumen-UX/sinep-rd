'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import AdminWizardProgress from './AdminWizardProgress'

type WizardStep = {
  label: string
  description?: string
}

type Props = {
  children: ReactNode
  formSelector?: string
}

function readSteps(form: HTMLFormElement): WizardStep[] {
  return Array.from(form.querySelectorAll(':scope > section')).map((section, index) => {
    const eyebrow = section.querySelector('.eyebrow')?.textContent?.trim()
    const heading = section.querySelector('h2')?.textContent?.trim()

    return {
      label: heading || eyebrow || `Paso ${index + 1}`,
      description: eyebrow && eyebrow !== heading ? eyebrow : undefined,
    }
  })
}

function findSubmitButton(form: HTMLFormElement) {
  return form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])')
}

export default function AutoSectionWizard({ children, formSelector = 'form.admin-form' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<WizardStep[]>([])
  const [submitLabel, setSubmitLabel] = useState('Guardar')
  const [submitDisabled, setSubmitDisabled] = useState(false)

  const synchronize = useCallback(() => {
    const root = rootRef.current
    const form = root?.querySelector<HTMLFormElement>(formSelector)
    if (!form) return

    const sections = Array.from(form.querySelectorAll<HTMLElement>(':scope > section'))
    const nextSteps = readSteps(form)
    const safeStep = Math.min(currentStep, Math.max(0, sections.length - 1))

    sections.forEach((section, index) => {
      section.hidden = index !== safeStep
    })

    const submitButton = findSubmitButton(form)
    if (submitButton) {
      if (!submitButton.hidden) submitButton.hidden = true
      const nextLabel = submitButton.textContent?.trim() || 'Guardar'
      setSubmitLabel((current) => current === nextLabel ? current : nextLabel)
      setSubmitDisabled((current) => current === submitButton.disabled ? current : submitButton.disabled)
    }

    setSteps((current) => {
      const currentSignature = JSON.stringify(current)
      const nextSignature = JSON.stringify(nextSteps)
      return currentSignature === nextSignature ? current : nextSteps
    })

    if (safeStep !== currentStep) setCurrentStep(safeStep)
  }, [currentStep, formSelector])

  useEffect(() => {
    synchronize()

    const root = rootRef.current
    if (!root) return

    const observer = new MutationObserver(synchronize)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['disabled'],
      characterData: true,
      childList: true,
      subtree: true,
    })
    return () => observer.disconnect()
  }, [synchronize])

  const submitForm = useCallback(() => {
    const form = rootRef.current?.querySelector<HTMLFormElement>(formSelector)
    if (!form) return

    const submitButton = findSubmitButton(form)
    if (!submitButton || submitButton.disabled) return
    form.requestSubmit(submitButton)
  }, [formSelector])

  const isFinalStep = steps.length > 0 && currentStep === steps.length - 1

  return (
    <div ref={rootRef} className="auto-section-wizard">
      {steps.length > 1 && (
        <AdminWizardProgress
          steps={steps}
          currentStep={currentStep}
          maxReachableStep={steps.length - 1}
          onStepChange={setCurrentStep}
        />
      )}

      <div className="auto-section-wizard__content">{children}</div>

      {steps.length > 1 && (
        <div className="auto-section-wizard__actions" aria-label="Navegación del asistente">
          <button
            className="button button-secondary"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}
            type="button"
          >
            Anterior
          </button>
          {isFinalStep ? (
            <button
              className="button button-primary"
              disabled={submitDisabled}
              onClick={submitForm}
              type="button"
            >
              {submitLabel}
            </button>
          ) : (
            <button
              className="button button-primary"
              onClick={() => setCurrentStep((value) => Math.min(steps.length - 1, value + 1))}
              type="button"
            >
              Siguiente
            </button>
          )}
        </div>
      )}
    </div>
  )
}
