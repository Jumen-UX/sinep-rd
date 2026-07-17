'use client'

import Link from 'next/link'
import { ThemeControl } from '@/components/theme/ThemeControl'
import type { PublicView } from '@/lib/public/dashboard'
import { sideNav, views, type Props } from './PublicDashboardShared'
import { PublicAdministrativeView, PublicCollegialView } from './PublicOrganizationViews'
import { PublicPastoralView, PublicPeopleView } from './PublicPeoplePastoralViews'
import { PublicTerritorialView } from './PublicTerritorialView'
import { usePublicDashboardModel } from './usePublicDashboardModel'

export default function PublicDashboardClient(props: Props) {
  const model = usePublicDashboardModel(props)
  const {
    initialData,
    activeView,
    setActiveView,
    country,
    setCountry,
    province,
    setProvince,
    jurisdictionId,
    setJurisdictionId,
    provinces,
    provinceDioceses,
    resetScope,
  } = model

  return (
    <div className="public-dashboard-layout">
      <header className="public-mobile-header">
        <Link className="public-mobile-brand" href="/"><span className="public-brand-mark" aria-hidden="true">✛</span><span><span className="public-brand-title">SINEP RD</span><span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span></span></Link>
        <ThemeControl compact />
        <Link className="public-mobile-icon-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link>
      </header>
      <aside className="public-sidebar" aria-label="Menú principal">
        <Link className="public-sidebar-brand" href="/"><span className="public-brand-mark" aria-hidden="true">✛</span><span><span className="public-brand-title">SINEP RD</span><span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span></span></Link>
        <nav className="public-sidebar-nav">{sideNav.map((item) => <Link className={`public-sidebar-link ${item.href === '/' && activeView === 'territorial' ? 'active' : ''}`} href={item.href} key={item.label}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>)}</nav>
        <div className="public-sidebar-footer"><strong>Sistema eclesial</strong><span>República Dominicana</span><span>Entorno de desarrollo</span></div>
      </aside>

      <main className="public-main">
        <div className="public-topbar"><ThemeControl compact /><Link className="public-user-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link></div>
        <section className="public-panel public-filter-panel" aria-labelledby="ambito-title">
          <div className="public-panel-title"><div className="public-heading-accent"><h1 id="ambito-title">Ámbito de consulta</h1></div><button className="public-clear-button" onClick={resetScope} type="button">↻ Limpiar filtros</button></div>
          <div className="public-filter-grid">
            <label>País<select value={country} onChange={(event) => { setCountry(event.target.value); resetScope() }}>{initialData.countries.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
            <label>Provincia eclesiástica<select value={province} onChange={(event) => { setProvince(event.target.value); setJurisdictionId('') }}><option value="">Todas las provincias</option>{provinces.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
            <label>Jurisdicción<select value={jurisdictionId} onChange={(event) => setJurisdictionId(event.target.value)}><option value="">Todas las jurisdicciones</option>{provinceDioceses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Vista activa<select value={activeView} onChange={(event) => setActiveView(event.target.value as PublicView)}>{views.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</select></label>
          </div>
        </section>

        <section className="public-tabs" role="tablist" aria-label="Vistas públicas">{views.map((view) => <button aria-controls={`panel-${view.key}`} aria-selected={activeView === view.key} className={`public-tab ${activeView === view.key ? 'active' : ''}`} id={`tab-${view.key}`} key={view.key} onClick={() => setActiveView(view.key)} role="tab" type="button"><span aria-hidden="true">{view.icon}</span><span>{view.title}</span></button>)}</section>

        {activeView === 'territorial' && <PublicTerritorialView model={model} />}
        {activeView === 'clero' && <PublicPeopleView model={model} />}
        {activeView === 'pastoral' && <PublicPastoralView model={model} />}
        {activeView === 'administrativa' && <PublicAdministrativeView model={model} />}
        {activeView === 'colegial' && <PublicCollegialView model={model} />}

        <nav className="public-bottom-nav" aria-label="Navegación móvil"><Link href="/"><span aria-hidden="true">⌂</span><span>Inicio</span></Link><Link href="/?vista=territorial"><span aria-hidden="true">▱</span><span>Territorio</span></Link><Link href="/personas"><span aria-hidden="true">♙</span><span>Personas</span></Link><Link href="/diocesis"><span aria-hidden="true">✥</span><span>Diócesis</span></Link></nav>
      </main>
    </div>
  )
}
