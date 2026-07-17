import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { AccessibilityTools } from '../components/accessibility/AccessibilityTools'
import { ThemeControl } from '../components/theme/ThemeControl'
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
import './public-territorial.css'
import './public-combobox.css'
import './scope-back-controls.css'
import './brand.css'
import './admin-brand.css'
import './public-shell.css'
import '../styles/accessibility-tools.css'

const themeBootstrapScript = `
  (() => {
    try {
      const preference = localStorage.getItem('sinep-theme');
      const theme = preference === 'light' || preference === 'dark'
        ? preference
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
    }
  })();
`

const accessibilityBootstrapScript = `
  (() => {
    try {
      const storedValue = localStorage.getItem('sinep-accessibility');
      if (!storedValue) return;

      const preferences = JSON.parse(storedValue);
      const root = document.documentElement;

      if (preferences.textScale === 'large' || preferences.textScale === 'xlarge') {
        root.dataset.textScale = preferences.textScale;
      }
      if (preferences.highContrast === true) root.dataset.contrast = 'high';
      if (preferences.reduceMotion === true) root.dataset.reduceMotion = 'true';
      if (preferences.underlineLinks === true) root.dataset.underlineLinks = 'true';
    } catch {
      localStorage.removeItem('sinep-accessibility');
    }
  })();
`

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
    <html lang="es" suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        <Script id="accessibility-bootstrap" strategy="beforeInteractive">
          {accessibilityBootstrapScript}
        </Script>
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
              <div className="site-header-actions">
                <nav aria-label="Navegación principal">
                  <Link href="/">Inicio</Link>
                  <Link href="/diocesis">Diócesis</Link>
                  <Link href="/personas">Personas</Link>
                  <Link href="/admin">Administración</Link>
                </nav>
                <ThemeControl compact />
              </div>
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
        <AccessibilityTools />
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
