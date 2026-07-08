'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdmin) {
    return (
      <div className="site-shell admin-shell">
        <header className="site-header admin-site-header">
          <nav className="site-nav" aria-label="Navegación administrativa">
            <Link className="brand" href="/admin">
              <span className="brand-title">SINEP RD</span>
              <span className="brand-subtitle">Portal administrativo</span>
            </Link>
            <div className="nav-links">
              <Link href="/admin">Inicio</Link>
              <Link href="/admin/eventos">Registro histórico</Link>
              <Link href="/admin/jurisdicciones">Gobierno eclesial</Link>
              <Link href="/admin/estructura">Estructura</Link>
              <Link href="/admin/usuarios">Usuarios</Link>
              <Link href="/">Portal público</Link>
            </div>
          </nav>
        </header>
        {children}
      </div>
    )
  }

  return (
    <div className="site-shell public-shell">
      <header className="site-header">
        <nav className="site-nav" aria-label="Navegación pública">
          <Link className="brand" href="/">
            <span className="brand-title">SINEP RD</span>
            <span className="brand-subtitle">Información Eclesiástica y Pastoral</span>
          </Link>
          <div className="nav-links">
            <Link href="/diocesis">Diócesis</Link>
            <Link href="/personas">Clero y agentes</Link>
            <Link href="/admin/login">Iniciar sesión</Link>
          </div>
        </nav>
      </header>
      {children}
      <footer className="site-footer">
        SINEP RD · Sistema Nacional de Información Eclesiástica y Pastoral
      </footer>
    </div>
  )
}
