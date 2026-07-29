import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { AccessibilityTools } from '../components/accessibility/AccessibilityTools'
import './globals.css'
import './fonts.css'
import './web-standards.css'
import './hierarchy.css'
import './dashboard.css'
import './home.css'
import './brand.css'
import './public-brand-overrides.css'
import './public-shell.css'
import '../styles/dashboard-theme-surfaces.css'
import '../styles/accessibility-tools.css'
import '../styles/reflow-accessibility.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

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
      // A malformed or unavailable preference store must not block page rendering.
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
      <body className={inter.variable}>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        <Script id="accessibility-bootstrap" strategy="beforeInteractive">
          {accessibilityBootstrapScript}
        </Script>
        <a className="skip-link" href="#contenido-principal">Saltar al contenido principal</a>
        {children}
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
