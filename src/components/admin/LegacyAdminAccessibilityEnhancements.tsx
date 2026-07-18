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

const formFieldSelector = 'input:not([type="hidden"]), select, textarea'

const modernAdminRootSelector = [
  '.event-assistant-page',
  '.events-page',
  '.event-review-page',
  '.event-action-plan-page',
  '.event-application-contract-page',
  '.event-workflow-verification-page',
  '.pending-events-page',
  '.level-office-page',
  '.structure-selector',
  '.admin-priest-wizard',
  '.admin-deacon-wizard',
  '.admin-bishop-wizard',
  '.admin-religious-wizard',
  '.admin-lay-wizard',
].join(',')

function belongsToModernizedAdminFlow(element: Element) {
  return Boolean(element.closest(modernAdminRootSelector))
}

function configureLiveRegion(
  message: HTMLElement,
  priority: 'assertive' | 'polite',
  role: 'alert' | 'status',
) {
  if (!message.hasAttribute('role')) message.setAttribute('role', role)
  if (!message.hasAttribute('aria-live')) message.setAttribute('aria-live', priority)
  if (!message.hasAttribute('aria-atomic')) message.setAttribute('aria-atomic', 'true')
}

function appendDescriptionId(field: HTMLElement, descriptionId: string) {
  const ids = new Set(
    (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean),
  )
  ids.add(descriptionId)
  field.setAttribute('aria-describedby', Array.from(ids).join(' '))
}

function removeDescriptionId(field: HTMLElement, descriptionId: string) {
  const ids = (field.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id && id !== descriptionId)

  if (ids.length > 0) field.setAttribute('aria-describedby', ids.join(' '))
  else field.removeAttribute('aria-describedby')
}

function associateLegacyFormErrors(root: ParentNode) {
  root.querySelectorAll<HTMLFormElement>('form').forEach((form, formIndex) => {
    if (belongsToModernizedAdminFlow(form)) return

    const error =
      form.querySelector<HTMLElement>('.error-box, [role="alert"]') ??
      form.parentElement?.querySelector<HTMLElement>(
        ':scope > .error-box, :scope > [role="alert"]',
      )
    if (!error || !error.textContent?.trim()) return

    const fields = Array.from(
      form.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(formFieldSelector),
    )
    const invalidField = fields.find(
      (field) => !field.disabled && !field.checkValidity(),
    )
    if (!invalidField) return

    const errorId = error.id || `legacy-form-error-${formIndex + 1}`
    error.id = errorId
    invalidField.setAttribute('aria-invalid', 'true')
    invalidField.dataset.a11yErrorId = errorId
    appendDescriptionId(invalidField, errorId)

    if (error.dataset.a11yFieldLinked !== 'true') {
      error.dataset.a11yFieldLinked = 'true'
      queueMicrotask(() => invalidField.focus())
    }
  })
}

function enhanceLegacyAdmin(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>('.error-box, .admin-navigation-error')
    .forEach((message) => {
      if (belongsToModernizedAdminFlow(message)) return
      configureLiveRegion(message, 'assertive', 'alert')
    })

  root
    .querySelectorAll<HTMLElement>(
      '.empty-state, .success-box, .admin-warning-box, .admin-info-box, .admin-navigation-status',
    )
    .forEach((message) => {
      if (belongsToModernizedAdminFlow(message)) return
      configureLiveRegion(message, 'polite', 'status')
    })

  root
    .querySelectorAll<HTMLElement>('[data-loading="true"], [aria-busy="true"]')
    .forEach((region) => {
      if (belongsToModernizedAdminFlow(region)) return
      if (region.getAttribute('aria-busy') !== 'true') {
        region.setAttribute('aria-busy', 'true')
      }
    })

  associateLegacyFormErrors(root)
}

export function LegacyAdminAccessibilityEnhancements() {
  useEffect(() => {
    const root = document.querySelector('.admin-area') ?? document.body
    let returnFocus: HTMLElement | null = null

    function openMobileDialog() {
      const menu = document.querySelector<HTMLElement>('#admin-mobile-menu')
      const dialog = menu?.querySelector<HTMLElement>('[role="dialog"]')
      if (!menu || menu.hidden || !dialog || dialog.dataset.a11yOpen === 'true') {
        return
      }

      const trigger = document.querySelector<HTMLElement>(
        '[aria-controls="admin-mobile-menu"]',
      )
      returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : trigger
      dialog.dataset.a11yOpen = 'true'
      dialog.setAttribute('aria-modal', 'true')
      dialog.setAttribute('tabindex', '-1')

      queueMicrotask(() => {
        const closeButton = dialog.querySelector<HTMLElement>(
          'button[aria-label*="Cerrar"]',
        )
        ;(closeButton ?? dialog).focus()
      })
    }

    function restoreMobileDialogFocus() {
      const menu = document.querySelector<HTMLElement>('#admin-mobile-menu')
      const dialog = menu?.querySelector<HTMLElement>('[role="dialog"]')
      if (
        !dialog ||
        menu?.hidden !== true ||
        dialog.dataset.a11yOpen !== 'true'
      ) {
        return
      }

      delete dialog.dataset.a11yOpen
      returnFocus?.focus()
      returnFocus = null
    }

    function synchronize() {
      enhanceLegacyAdmin(root)
      openMobileDialog()
      restoreMobileDialogFocus()
    }

    function handleFieldCorrection(event: Event) {
      const field = event.target
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLTextAreaElement
        )
      ) {
        return
      }
      if (!field.checkValidity()) return

      const errorId = field.dataset.a11yErrorId
      if (!errorId) return

      field.removeAttribute('aria-invalid')
      removeDescriptionId(field, errorId)
      delete field.dataset.a11yErrorId
    }

    function handleKeyDown(event: KeyboardEvent) {
      const menu = document.querySelector<HTMLElement>('#admin-mobile-menu')
      const dialog = menu?.querySelector<HTMLElement>('[role="dialog"]')
      if (!menu || menu.hidden || !dialog) return

      if (event.key === 'Escape') {
        event.preventDefault()
        dialog
          .querySelector<HTMLButtonElement>('button[aria-label*="Cerrar"]')
          ?.click()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          !element.hasAttribute('hidden') &&
          element.getAttribute('aria-hidden') !== 'true',
      )
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
    root.addEventListener('input', handleFieldCorrection)
    root.addEventListener('change', handleFieldCorrection)

    const observer = new MutationObserver(synchronize)
    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        'class',
        'hidden',
        'aria-expanded',
        'aria-busy',
        'data-loading',
      ],
      childList: true,
      subtree: true,
    })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      root.removeEventListener('input', handleFieldCorrection)
      root.removeEventListener('change', handleFieldCorrection)
      observer.disconnect()
    }
  }, [])

  return null
}
