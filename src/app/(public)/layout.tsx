import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import '../public-profile-print.css'
import {
  buildPublicMetadata,
  getPublicMetadataBase,
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_NAME,
} from '@/lib/public/metadata'

export const metadata: Metadata = {
  metadataBase: getPublicMetadataBase(),
  ...buildPublicMetadata({
    title: PUBLIC_SITE_NAME,
    description: PUBLIC_SITE_DESCRIPTION,
    path: '/',
  }),
  title: {
    default: PUBLIC_SITE_NAME,
    template: `%s | ${PUBLIC_SITE_NAME}`,
  },
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container site-header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">SD</span>
            <span>
              <strong>SINEP RD</strong>
              <small>Información eclesial y pastoral</small>
            </span>
          </Link>
          <div className="site-header-actions">
            <nav aria-label="Navegación principal">
              <Link href="/">Inicio</Link>
              <Link href="/diocesis">Diócesis</Link>
              <Link href="/personas">Personas</Link>
              <Link href="/admin">Administración</Link>
            </nav>
          </div>
        </div>
      </header>

      <div id="contenido-principal" tabIndex={-1}>
        {children}
      </div>

      <footer className="site-footer">
        <div className="container">
          <p>SINEP RD · Plataforma de información eclesiástica y pastoral</p>
          <nav className="site-footer-links" aria-label="Información legal">
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/aviso-legal">Aviso legal</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
