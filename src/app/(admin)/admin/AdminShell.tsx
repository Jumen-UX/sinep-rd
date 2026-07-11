'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AdminNavItem = {
  href: string
  icon: string
  label: string
  sublabel?: string
}

type AdminNavSection = {
  title: string
  items: AdminNavItem[]
}

type IncompatibilityQueue = {
  total?: number
}

const adminNavSections: AdminNavSection[] = [
  {
    title: 'Principal',
    items: [
      { href: '/admin', icon: '⌂', label: 'Inicio', sublabel: 'Panel general' },
      { href: '/admin/nuevo', icon: '＋', label: 'Agregar ficha', sublabel: 'Asistentes de registro' },
      { href: '/admin/importar', icon: '⇪', label: 'Carga por lotes', sublabel: 'CSV y Excel' },
    ],
  },
  {
    title: 'Gestión eclesial',
    items: [
      { href: '/admin/jurisdicciones', icon: '▥', label: 'Jurisdicciones', sublabel: 'Diócesis y provincias' },
      { href: '/admin/estructura', icon: '▦', label: 'Estructura', sublabel: 'Niveles y nodos' },
      { href: '/admin/personas', icon: '◉', label: 'Personas', sublabel: 'Clero y agentes' },
      { href: '/admin/asignaciones', icon: '▣', label: 'Nombramientos', sublabel: 'Cargos y sucesión' },
    ],
  },
  {
    title: 'Datos y revisión',
    items: [
      { href: '/admin/paises', icon: '◎', label: 'Países ISO', sublabel: 'Banderas y visibilidad' },
      { href: '/admin/eventos', icon: '◷', label: 'Historial', sublabel: 'Eventos y fuentes' },
      { href: '/admin/revision', icon: '!', label: 'Pendientes', sublabel: 'Validación' },
      { href: '/admin/incompatibilidades-canonicas', icon: '⚠', label: 'Incompatibilidades', sublabel: 'Nombramientos y reglas' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/admin/usuarios', icon: '♙', label: 'Usuarios', sublabel: 'Roles y accesos' },
      { href: '/admin/configuracion', icon: '⚙', label: 'Configuración', sublabel: 'Catálogos y reglas' },
    ],
  },
]

const mobileNavItems: AdminNavItem[] = [
  { href: '/admin', icon: 'I', label: 'Inicio' },
  { href: '/admin/personas', icon: 'P', label: 'Personas' },
  { href: '/admin/estructura', icon: 'E', label: 'Estructura' },
  { href: '/admin/configuracion', icon: 'M', label: 'Más' },
]

function isActiveNavItem(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function forceNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.location.assign(href)
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [canonicalIncompatibilities, setCanonicalIncompatibilities] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCanonicalIncompatibilities() {
      if (pathname === '/admin/login') return

      const { data, error } = await supabase.rpc('admin_list_assignment_canonical_incompatibilities', {
        p_status: 'open',
        p_limit: 1,
      })

      if (cancelled) return
      if (error) {
        setCanonicalIncompatibilities(null)
        return
      }

      const queue = data as IncompatibilityQueue | null
      setCanonicalIncompatibilities(typeof queue?.total === 'number' ? queue.total : 0)
    }

    loadCanonicalIncompatibilities()

    return () => {
      cancelled = true
    }
  }, [pathname, supabase])

  if (pathname === '/admin/login') {
    return <div className="admin-area admin-login-shell">{children}</div>
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

          <nav className="admin-sidebar-nav">
            {adminNavSections.map((section) => (
              <section className="admin-sidebar-section" key={section.title}>
                <p>{section.title}</p>
                <div>
                  {section.items.map((item) => {
                    const isCanonicalQueue = item.href === '/admin/incompatibilidades-canonicas'
                    const badge = isCanonicalQueue && canonicalIncompatibilities !== null
                      ? canonicalIncompatibilities
                      : null

                    return (
                      <a aria-current={isActiveNavItem(pathname, item.href) ? 'page' : undefined} href={item.href} key={`${item.href}-${item.label}`} onClick={(event) => forceNavigation(event, item.href)}>
                        <span aria-hidden="true">{item.icon}</span>
                        <span>
                          <strong>{item.label}{badge !== null && badge > 0 ? ` · ${badge}` : ''}</strong>
                          {item.sublabel && <small>{item.sublabel}</small>}
                        </span>
                      </a>
                    )
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="admin-sidebar-help">
            <span>?</span>
            <strong>Ayuda</strong>
            <small>Configuración, catálogos y validaciones.</small>
            <a href="/admin/configuracion" onClick={(event) => forceNavigation(event, '/admin/configuracion')}>Centro de ayuda</a>
          </div>
        </aside>

        <div className="admin-workspace">
          {pathname === '/admin' && canonicalIncompatibilities !== null && canonicalIncompatibilities > 0 && (
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

      <nav className="admin-mobile-nav" aria-label="Navegación administrativa móvil">
        {mobileNavItems.map((item) => (
          <a aria-current={isActiveNavItem(pathname, item.href) ? 'page' : undefined} href={item.href} key={item.href} onClick={(event) => forceNavigation(event, item.href)}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
