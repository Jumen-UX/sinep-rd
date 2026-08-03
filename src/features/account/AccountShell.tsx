'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './account.module.css'

const ITEMS = [
  { href: '/cuenta', label: 'Resumen', description: 'Estado general de tu cuenta' },
  { href: '/cuenta/perfil', label: 'Perfil', description: 'Datos personales y preferencias' },
]

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
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </Link>
            )
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/">Sitio público</Link>
          <Link href="/admin">Administración</Link>
        </div>
      </aside>
      <div className={styles.accountWorkspace}>{children}</div>
    </div>
  )
}
