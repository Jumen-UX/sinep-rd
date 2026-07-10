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
            <div className="container site-header-inner">
              <Link className="brand" href="/">
                <span className="brand-mark" aria-hidden="true">SD</span>
                <span>
                  <strong>SINEP RD</strong>
                  <small>Sistema de Información Eclesial</small>
                </span>
              </Link>
              <nav aria-label="Navegación principal">
                <Link href="/">Inicio</Link>
                <Link href="/diocesis">Diócesis</Link>
                <Link href="/personas">Personas</Link>
                <Link href="/admin">Administración</Link>
              </nav>
            </div>
          </header>

          {children}

          <footer className="site-footer">
            <div className="container">
              <p>SINEP RD · Sistema Nacional de Información Eclesiástica y Pastoral</p>
            </div>
          </footer>
        </div>

        <PublicCountryFlagEnhancements />
        <PublicDashboardEntityCards />
        <PublicJurisdictionStructureNavigation />
        <PublicMultiCountryDashboard />
        <PublicPastoralEnhancements />
        <PublicTerritorialLevelEnhancements />
        <ScopeBackControls />
      </body>
    </html>
  )
}
