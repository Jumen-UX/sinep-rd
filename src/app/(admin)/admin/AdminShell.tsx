'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadCanonicalIncompatibilityCount } from '@/features/appointments/services/canonical-incompatibility-queue'
import {
  AdminNavigationProvider,
  useAdminNavigation,
} from '@/features/admin/navigation/AdminNavigationProvider'
import { isActiveAdminNavigationItem } from '@/features/admin/navigation/admin-navigation-policy'

function forceNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.location.assign(href)
}

function ScopeControl({ compact = false }: { compact?: boolean }) {
  const { context, selectScope } = useAdminNavigation()
  if (!context) return null

  const scopes = context.availableScopes
  const activeScope = context.activeScope

  return (
    <div className={compact ? 'admin-scope-control is-compact' : 'admin-scope-control'}>
      <span>Ámbito activo</span>
      {scopes.length > 1 ? (
        <label>
          <span className="sr-only">Cambiar ámbito administrativo</span>
          <select
            aria-label="Cambiar ámbito administrativo"
            onChange={(event) => selectScope(event.target.value)}
            value={activeScope.key}
          >
            {scopes.map((scope) => (
              <option key={scope.key} value={scope.key}>
                {scope.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <strong>{activeScope.label}</strong>
      )}
      {!compact && context.roles.length > 0 && (
        <small>
          {context.roles.length === 1
            ? context.roles[0].name
            : `${context.roles.length} roles administrativos activos`}
        </small>
      )}
    </div>
  )
}

function AdminShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const {
    sections,
    mobileItems,
    loading: navigationLoading,
    error: navigationError,
    refresh,
  } = useAdminNavigation()
  const [canonicalIncompatibilities, setCanonicalIncompatibilities] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const canViewCanonicalQueue = sections.some((section) => (
    section.items.some((item) => item.id === 'canonical-incompatibilities')
  ))
  const settingsItem = sections
    .flatMap((section) => section.items)
    .find((item) => item.id === 'settings')

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    let cancelled = false

    async function loadQueue() {
      if (!canViewCanonicalQueue) {
        setCanonicalIncompatibilities(null)
        return
      }

      try {
        const count = await loadCanonicalIncompatibilityCount(supabase)
        if (!cancelled) setCanonicalIncompatibilities(count)
      } catch {
        if (!cancelled) setCanonicalIncompatibilities(null)
      }
    }

    void loadQueue()

    return () => {
      cancelled = true
    }
  }, [canViewCanonicalQueue, pathname, supabase])

  function renderNavigationLinks(closeMobile = false) {
    if (navigationLoading) {
      return <p className="admin-navigation-status">Cargando navegación autorizada...</p>
    }

    if (navigationError) {
      return (
        <div className="admin-navigation-error" role="alert">
          <strong>No se pudo cargar la navegación</strong>
          <small>{navigationError}</small>
          <button onClick={() => void refresh()} type="button">Reintentar</button>
        </div>
      )
    }

    return sections.map((section) => (
      <section className="admin-sidebar-section" key={section.key}>
        <p>{section.label}</p>
        <div>
          {section.items.map((item) => {
            const badge = item.id === 'canonical-incompatibilities' && canonicalIncompatibilities !== null
              ? canonicalIncompatibilities
              : null
            const readOnlyLabel = item.availability === 'read_only' ? ' · Consulta' : ''

            return (
              <a
                aria-current={isActiveAdminNavigationItem(pathname, item.href) ? 'page' : undefined}
                href={item.href}
                key={item.id}
                onClick={(event) => {
                  if (closeMobile) setMobileMenuOpen(false)
                  forceNavigation(event, item.href)
                }}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>
                  <strong>{item.label}{badge !== null && badge > 0 ? ` · ${badge}` : ''}</strong>
                  <small>{item.sublabel}{readOnlyLabel}</small>
                </span>
              </a>
            )
          })}
        </div>
      </section>
    ))
  }

  return (
    <div className="admin-area">
      <div className="admin-redesign">
        <aside className="admin-sidebar" aria-label="Navegación administrativa">
          <a className="admin-brand-block" href="/admin" onClick={(event) => forceNavigation(event, '/admin')}>
            <span className="admin-brand-shield">SD</span>
            <span>
              <strong>SINEP RD</strong>
              <small>Sistema de Información Eclesial</small>
            </span>
          </a>

          <ScopeControl />

          <nav className="admin-sidebar-nav">
            {renderNavigationLinks()}
          </nav>

          <div className="admin-sidebar-help">
            <span aria-hidden="true">?</span>
            <strong>Ayuda contextual</strong>
            <small>Consulta permisos, alcance y reglas de operación.</small>
            {settingsItem ? (
              <a href={settingsItem.href} onClick={(event) => forceNavigation(event, settingsItem.href)}>Abrir configuración</a>
            ) : (
              <a href="/admin" onClick={(event) => forceNavigation(event, '/admin')}>Volver al resumen</a>
            )}
          </div>
        </aside>

        <div className="admin-workspace">
          {pathname === '/admin' && canonicalIncompatibilities !== null && canonicalIncompatibilities > 0 && canViewCanonicalQueue && (
            <section className="admin-dashboard-review-notice has-pending" aria-label="Incompatibilidades canónicas pendientes">
              <span className="admin-dashboard-review-icon" aria-hidden="true">!</span>
              <div>
                <strong>Nombramientos incompatibles con las reglas vigentes</strong>
                <p>{canonicalIncompatibilities} caso{canonicalIncompatibilities === 1 ? '' : 's'} requiere{canonicalIncompatibilities === 1 ? '' : 'n'} revisión canónica.</p>
              </div>
              <a href="/admin/incompatibilidades-canonicas" onClick={(event) => forceNavigation(event, '/admin/incompatibilidades-canonicas')}>Abrir bandeja</a>
            </section>
          )}
          {children}
        </div>
      </div>

      {!navigationLoading && !navigationError && mobileItems.length > 0 && (
        <nav className="admin-mobile-nav" aria-label="Navegación administrativa móvil">
          {mobileItems.map((item) => (
            <a
              aria-current={isActiveAdminNavigationItem(pathname, item.href) ? 'page' : undefined}
              href={item.href}
              key={item.id}
              onClick={(event) => forceNavigation(event, item.href)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
          <button
            aria-controls="admin-mobile-menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((current) => !current)}
            type="button"
          >
            <span aria-hidden="true">☰</span>
            <span>Más</span>
          </button>
        </nav>
      )}

      <div
        className="admin-mobile-menu"
        hidden={!mobileMenuOpen}
        id="admin-mobile-menu"
      >
        <button
          aria-label="Cerrar navegación administrativa"
          className="admin-mobile-menu-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
        <section aria-label="Todos los módulos administrativos" role="dialog">
          <header>
            <div>
              <strong>Navegación administrativa</strong>
              <ScopeControl compact />
            </div>
            <button aria-label="Cerrar" onClick={() => setMobileMenuOpen(false)} type="button">×</button>
          </header>
          <nav className="admin-sidebar-nav">
            {renderNavigationLinks(true)}
          </nav>
        </section>
      </div>
    </div>
  )
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return <div className="admin-area admin-login-shell">{children}</div>
  }

  return (
    <AdminNavigationProvider>
      <AdminShellContent>{children}</AdminShellContent>
    </AdminNavigationProvider>
  )
}
