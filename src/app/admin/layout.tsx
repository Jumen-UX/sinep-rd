import type { ReactNode } from 'react'
import Link from 'next/link'

type AdminNavItem = {
  href: string
  icon: string
  label: string
  sublabel?: string
}

const adminNavItems: AdminNavItem[] = [
  { href: '/admin', icon: '⌂', label: 'Inicio', sublabel: 'Panel general' },
  { href: '/admin/nuevo', icon: '＋', label: 'Agregar nueva ficha', sublabel: 'Asistentes de registro' },
  { href: '/admin/jurisdicciones', icon: '▥', label: 'Jurisdicciones', sublabel: 'Diócesis y provincias' },
  { href: '/admin/estructura', icon: '▦', label: 'Estructura interna', sublabel: 'Niveles, nodos y catálogos' },
  { href: '/admin/personas', icon: '◉', label: 'Personas', sublabel: 'Clero, religiosos, laicos' },
  { href: '/admin/asignaciones', icon: '▣', label: 'Nombramientos', sublabel: 'Cargos y asignaciones' },
  { href: '/admin/paises', icon: '◎', label: 'Países ISO', sublabel: 'Banderas y visibilidad' },
  { href: '/admin/eventos', icon: '◷', label: 'Eventos históricos', sublabel: 'Fuentes y trazabilidad' },
  { href: '/admin/revision', icon: '!', label: 'Pendientes', sublabel: 'Validación y revisión' },
  { href: '/admin/usuarios', icon: '♙', label: 'Usuarios y permisos', sublabel: 'Roles y accesos' },
  { href: '/admin/configuracion', icon: '⚙', label: 'Configuración', sublabel: 'Catálogos y reglas' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .site-shell > .site-header,
        .site-shell > .site-footer{display:none}
        .admin-area{min-height:100vh;background:#fbfaf7}
      `}</style>
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
              {adminNavItems.map((item) => (
                <Link href={item.href} key={`${item.href}-${item.label}`}>
                  <span aria-hidden="true">{item.icon}</span>
                  <span>
                    <strong>{item.label}</strong>
                    {item.sublabel && <small>{item.sublabel}</small>}
                  </span>
                </Link>
              ))}
            </nav>

            <div className="admin-sidebar-help">
              <span>☏</span>
              <strong>Soporte administrativo</strong>
              <small>Consulta configuración, catálogos o validaciones del sistema.</small>
              <Link href="/admin/configuracion">Centro de ayuda</Link>
            </div>
          </aside>

          <div className="admin-workspace">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
