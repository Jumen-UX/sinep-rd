'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

const adminNavSections: AdminNavSection[] = [
  {
    title: 'Principal',
    items: [
      { href: '/admin', icon: '⌂', label: 'Inicio', sublabel: 'Panel general' },
      { href: '/admin/nuevo', icon: '＋', label: 'Agregar ficha', sublabel: 'Asistentes de registro' },
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

function isActiveNavItem(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return <div className="admin-area admin-login-shell">{children}</div>
  }

  return (
    <div className="admin-area">
      <div className="admin-redesign">
        <aside className="admin-sidebar" aria-label="Navegación administrativa">
          <Link className="admin-brand-block" href="/admin">
            <span className="admin-brand-shield">SD</span>
            <span>
              <strong>SINEP RD</strong>
              <small>Sistema de Información Eclesial</small>
            </span>
          </Link>

          <nav className="admin-sidebar-nav">
            {adminNavSections.map((section) => (
              <section className="admin-sidebar-section" key={section.title}>
                <p>{section.title}</p>
                <div>
                  {section.items.map((item) => (
                    <Link aria-current={isActiveNavItem(pathname, item.href) ? 'page' : undefined} href={item.href} key={`${item.href}-${item.label}`}>
                      <span aria-hidden="true">{item.icon}</span>
                      <span>
                        <strong>{item.label}</strong>
                        {item.sublabel && <small>{item.sublabel}</small>}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </nav>

          <div className="admin-sidebar-help">
            <span>?</span>
            <strong>Ayuda</strong>
            <small>Configuración, catálogos y validaciones.</small>
            <Link href="/admin/configuracion">Centro de ayuda</Link>
          </div>
        </aside>

        <div className="admin-workspace">
          {children}
        </div>
      </div>
    </div>
  )
}
