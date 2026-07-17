'use client'

import { useEffect } from 'react'

function enhanceLegacyAdmin(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.assistant-stepper').forEach((stepper) => {
    stepper.setAttribute('role', 'navigation')
    stepper.setAttribute('aria-label', 'Pasos del asistente')

    stepper.querySelectorAll<HTMLButtonElement>('.step-card').forEach((button, index) => {
      const title = button.querySelector('strong')?.textContent?.trim() || `Paso ${index + 1}`
      const isCurrent = button.classList.contains('active')

      button.setAttribute('aria-label', `Ir al paso ${index + 1}: ${title}`)
      if (isCurrent) button.setAttribute('aria-current', 'step')
      else button.removeAttribute('aria-current')
    })
  })

  root.querySelectorAll<HTMLButtonElement>('.mode-card').forEach((button) => {
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false')
  })

  root.querySelectorAll<HTMLElement>('.error-box').forEach((message) => {
    if (!message.hasAttribute('role')) message.setAttribute('role', 'alert')
    message.setAttribute('aria-live', 'assertive')
  })

  root.querySelectorAll<HTMLElement>('.empty-state').forEach((message) => {
    if (!message.hasAttribute('role')) message.setAttribute('role', 'status')
    message.setAttribute('aria-live', 'polite')
  })
}

export function LegacyAdminAccessibilityEnhancements() {
  useEffect(() => {
    const workspace = document.querySelector('.admin-workspace') ?? document.body
    enhanceLegacyAdmin(workspace)

    const observer = new MutationObserver(() => enhanceLegacyAdmin(workspace))
    observer.observe(workspace, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return null
}
