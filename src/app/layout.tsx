import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { PublicCountryFlagEnhancements } from '../features/public/components/public-country-flag-enhancements'
import { PublicDashboardEntityCards } from '../features/public/components/public-dashboard-entity-cards'
import { PublicJurisdictionStructureNavigation } from '../features/public/components/public-jurisdiction-structure-navigation'
import { PublicMultiCountryDashboard } from '../features/public/components/public-multi-country-dashboard'
import { PublicPastoralEnhancements } from '../features/public/components/public-pastoral-enhancements'
import { PublicTerritorialLevelEnhancements } from '../features/public/components/public-territorial-level-enhancements'
import { ScopeBackControls } from '../features/public/components/scope-back-controls'
import './globals.css'
import './web-standards.css'
import './hierarchy.css'
import './dashboard.css'
import './home.css'
import './public-dashboard.css'
import './public-combobox.css'
import './scope-back-controls.css'
import './brand.css'
import './admin-brand.css'

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
                <Link href="/personas">Clero y agentes</Link>
                <Link href="/admin/login">Iniciar sesión</Link>
              </div>
            </nav>
          </header>

          {children}
          <ScopeBackControls />
          <PublicCountryFlagEnhancements />
          <PublicDashboardEntityCards />
          <PublicJurisdictionStructureNavigation />
          <PublicMultiCountryDashboard />
          <PublicPastoralEnhancements />
          <PublicTerritorialLevelEnhancements />

          <footer className="site-footer">
            SINEP RD · Sistema Nacional de Información Eclesiástica y Pastoral
          </footer>
        </div>
      </body>
    </html>
  )
}
