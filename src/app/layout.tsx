import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'SINEP RD',
  description: 'Sistema Nacional de Información Eclesiástica y Pastoral de República Dominicana',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="es">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <nav className="site-nav" aria-label="Navegación principal">
              <Link className="brand" href="/">
                <span className="brand-title">SINEP RD</span>
                <span className="brand-subtitle">Información Eclesiástica y Pastoral</span>
              </Link>

              <div className="nav-links">
                <Link href="/diocesis">Diócesis</Link>
              </div>
            </nav>
          </header>

          {children}

          <footer className="site-footer">
            SINEP RD · Sistema Nacional de Información Eclesiástica y Pastoral
          </footer>
        </div>
      </body>
    </html>
  )
}
