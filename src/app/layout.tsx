import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Script from 'next/script'
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
  title: {
    default: 'SINEP RD',
    template: '%s | SINEP RD',
  },
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
        <a className="skip-link" href="#contenido-principal">Saltar al contenido principal</a>
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

          <div id="contenido-principal" tabIndex={-1}>
            {children}
          </div>

          <footer className="site-footer">
            <div className="container">
              <p>SINEP RD · Sistema Nacional de Información Eclesiástica y Pastoral</p>
              <nav className="site-footer-links" aria-label="Información legal">
                <Link href="/privacidad">Privacidad</Link>
                <Link href="/cookies">Cookies</Link>
                <Link href="/aviso-legal">Aviso legal</Link>
              </nav>
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
        <Script
          id="vercel-web-analytics"
          src="/_vercel/insights/script.js"
          strategy="afterInteractive"
          data-sdkn="@vercel/analytics/next"
          data-sdkv="2.0.1"
        />
        <Script
          id="vercel-speed-insights"
          src="/_vercel/speed-insights/script.js"
          strategy="afterInteractive"
          data-sdkn="@vercel/speed-insights/next"
          data-sdkv="2.0.0"
        />
      </body>
    </html>
  )
}
