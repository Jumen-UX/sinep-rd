'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './account.module.css'

type AccountIconName = 'home' | 'profile' | 'security' | 'access' | 'requests' | 'public' | 'admin'

const ITEMS: Array<{
  href: string
  label: string
  description: string
  icon: AccountIconName
}> = [
  { href: '/cuenta', label: 'Resumen', description: 'Estado general y acciones rápidas', icon: 'home' },
  { href: '/cuenta/perfil', label: 'Perfil', description: 'Datos personales y preferencias básicas', icon: 'profile' },
  { href: '/cuenta/seguridad', label: 'Seguridad', description: 'Contraseña y sesiones de la cuenta', icon: 'security' },
  { href: '/cuenta/accesos', label: 'Accesos', description: 'Roles y ámbitos autorizados', icon: 'access' },
  { href: '/cuenta/solicitudes', label: 'Solicitudes', description: 'Seguimiento de trámites personales', icon: 'requests' },
]

function AccountIcon({ name }: { name: AccountIconName }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }

  switch (name) {
    case 'home':
      return (
        <svg {...commonProps}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v11h14V9" />
          <path d="M9 20v-6h6v6" />
        </svg>
      )
    case 'profile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5.5 20c.65-3.75 3.2-6 6.5-6s5.85 2.25 6.5 6" />
        </svg>
      )
    case 'security':
      return (
        <svg {...commonProps}>
          <path d="M12 3 5.5 5.6v5.65c0 4.05 2.55 7.4 6.5 9.25 3.95-1.85 6.5-5.2 6.5-9.25V5.6L12 3Z" />
          <path d="m9.5 12 1.6 1.6 3.6-3.6" />
        </svg>
      )
    case 'access':
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="12" r="3" />
          <path d="M11 12h9" />
          <path d="M17 12v3" />
          <path d="M20 12v2" />
        </svg>
      )
    case 'requests':
      return (
        <svg {...commonProps}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      )
    case 'public':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 12h17" />
          <path d="M12 3a15 15 0 0 1 0 18" />
          <path d="M12 3a15 15 0 0 0 0 18" />
        </svg>
      )
    case 'admin':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .35 1.9l.05.05-2.85 2.85-.05-.05a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.55V21H10v-.05A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.35l-.05.05-2.85-2.85.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.35-1.9L4.2 7.05 7.05 4.2l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.9-.35l.05-.05 2.85 2.85-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      )
  }
}

export default function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className={styles.accountArea}>
      <aside className={styles.sidebar} aria-label="Navegación del Centro Personal">
        <Link className={styles.brand} href="/cuenta">
          <span aria-hidden="true">SD</span>
          <strong>SINEP</strong>
          <small>Centro Personal</small>
        </Link>
        <nav className={styles.navigation}>
          {ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link aria-current={active ? 'page' : undefined} href={item.href} key={item.href}>
                <span className={styles.navigationIcon} aria-hidden="true">
                  <AccountIcon name={item.icon} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            )
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/">
            <span className={styles.footerIcon} aria-hidden="true"><AccountIcon name="public" /></span>
            <span>Sitio público</span>
          </Link>
          <Link href="/admin">
            <span className={styles.footerIcon} aria-hidden="true"><AccountIcon name="admin" /></span>
            <span>Administración</span>
          </Link>
        </div>
      </aside>
      <div className={styles.accountWorkspace}>{children}</div>
    </div>
  )
}
