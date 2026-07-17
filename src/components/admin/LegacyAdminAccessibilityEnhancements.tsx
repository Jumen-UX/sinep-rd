'use client'

import { useEffect } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function configureLiveRegion(message: HTMLElement, priority: 'assertive' | 'polite', role: 'alert' | 'status') {
  if (!message.hasAttribute('role')) message.setAttribute('role', role)
  message.setAttribute('aria-live', priority)
  message.setAttribute('aria-atomic', 'true')
}

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

  root.querySelectorAll<HTMLElement>('.error-box, .admin-navigation-error').forEach((message) => {
    configureLiveRegion(message, 'assertive', 'alert')
  })

  root.querySelectorAll<HTMLElement>('.empty-state, .success-box, .admin-warning-box, .admin-info-box, .admin-navigation-status').forEach((message) => {
    configureLiveRegion(message, 'polite', 'status')
  })

  root.querySelectorAll<HTMLElement>('[data-loading="true"], [aria-busy="true"]').forEach((region) => {
    region.setAttribute('aria-busy', 'true')
  })
}

export function LegacyAdminAccessibilityEnhancements() {
  useEffect(() => {
    const root = document.querySelector('.admin-area') ?? document.body
    let returnFocus: HTMLElement | null = null

    function openMobileDialog() {
      const menu = document.querySelector<HTMLElement>('#admin-mobile-menu')
      const dialog = menu?.querySelector<HTMLElement>('[role="dialog"]')
      if (!menu || menu.hidden || !dialog || dialog.dataset.a11yOpen === 'true') return

      const trigger = document.querySelector<HTMLElement>('[aria-controls="admin-mobile-menu"]')
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger
      dialog.dataset.a11yOpen = 'true'
      dialog.setAttribute('aria-modal', 'true')
      dialog.setAttribute('tabindex', '-1')

      queueMicrotask(() => {
        const closeButton = dialog.querySelector<HTMLElement>('button[aria-label*="Cerrar"]')
        ;(closeButton ?? dialog).focus()
      })
    }

    function restoreMobileDialogFocus() {
      const menu = document.querySelector<HTMLElement>('#admin-mobile-menu')
      const dialog = menu?.querySelector<HTMLElement>('[role="dialog"]')
      if (!dialog || menu?.hidden !== true || dialog.dataset.a11yOpen !== 'true') return

      delete dialog.dataset.a11yOpen
      returnFocus?.focus()
      returnFocus = null
    }

    function synchronize() {
      enhanceLegacyAdmin(root)
      openMobileDialog()
      restoreMobileDialogFocus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      const menu = document.querySelector<HTMLElement>('#admin-mobile-menu')
      const dialog = menu?.querySelector<HTMLElement>('[role="dialog"]')
      if (!menu || menu.hidden || !dialog) return

      if (event.key === 'Escape') {
        event.preventDefault()
        dialog.querySelector<HTMLButtonElement>('button[aria-label*="Cerrar"]')?.click()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    synchronize()
    document.addEventListener('keydown', handleKeyDown)

    const observer = new MutationObserver(synchronize)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-expanded', 'aria-busy', 'data-loading'],
      childList: true,
      subtree: true,
    })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      observer.disconnect()
    }
  }, [])

  return null
}
