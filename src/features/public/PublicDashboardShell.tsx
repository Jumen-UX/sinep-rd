import Link from 'next/link'
import PublicDashboardExplorer from './PublicDashboardExplorer'
import { sideNav } from './PublicDashboardNavigation'
import type { Props } from './PublicDashboardShared'

export default function PublicDashboardShell(props: Props) {
  return (
    <div className="public-dashboard-layout">
      <header className="public-mobile-header">
        <Link className="public-mobile-brand" href="/">
          <span className="public-brand-mark" aria-hidden="true">✛</span>
          <span>
            <span className="public-brand-title">SINEP RD</span>
            <span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span>
          </span>
        </Link>
        <Link className="public-mobile-icon-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link>
      </header>

      <aside className="public-sidebar" aria-label="Menú principal">
        <Link className="public-sidebar-brand" href="/">
          <span className="public-brand-mark" aria-hidden="true">✛</span>
          <span>
            <span className="public-brand-title">SINEP RD</span>
            <span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span>
          </span>
        </Link>
        <nav className="public-sidebar-nav">
          {sideNav.map((item) => (
            <Link
              className={`public-sidebar-link ${item.href === '/' && props.initialView === 'territorial' ? 'active' : ''}`}
              href={item.href}
              key={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="public-sidebar-footer">
          <strong>Sistema eclesial</strong>
          <span>Cobertura internacional</span>
          <span>Entorno de desarrollo</span>
        </div>
      </aside>

      <main className="public-main">
        <div className="public-topbar">
          <span className="meta">Apariencia y accesibilidad disponibles en el botón flotante.</span>
          <Link className="public-user-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link>
        </div>

        <PublicDashboardExplorer {...props} />

        <nav className="public-bottom-nav" aria-label="Navegación móvil">
          <Link href="/"><span aria-hidden="true">⌂</span><span>Inicio</span></Link>
          <Link href="/?vista=territorial"><span aria-hidden="true">▱</span><span>Territorio</span></Link>
          <Link href="/personas"><span aria-hidden="true">♙</span><span>Personas</span></Link>
          <Link href="/diocesis"><span aria-hidden="true">✥</span><span>Diócesis</span></Link>
        </nav>
      </main>
    </div>
  )
}
