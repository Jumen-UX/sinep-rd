'use client'

import { lazy, Suspense } from 'react'
import type { PublicView } from '@/lib/public/dashboard'
import styles from './PublicDashboardExplorer.module.css'
import { views, type Props } from './PublicDashboardShared'
import { PublicTerritorialView } from './PublicTerritorialView'
import { usePublicDashboardModel } from './usePublicDashboardModel'

function PublicViewLoading({ view, label }: { view: PublicView; label: string }) {
  return (
    <section
      aria-busy="true"
      aria-labelledby={`tab-${view}`}
      className={`${styles.loadingPanel} public-directory-card public-panel`}
      id={`panel-${view}`}
      role="tabpanel"
    >
      <div className={`${styles.loadingMessage} public-empty`} role="status" aria-live="polite">
        <strong>Cargando {label}</strong>
        <br />
        <span>Preparando la información del ámbito seleccionado.</span>
      </div>
    </section>
  )
}

function PublicViewError({
  view,
  label,
  onRetry,
}: {
  view: PublicView
  label: string
  onRetry: () => void
}) {
  return (
    <section
      aria-labelledby={`tab-${view}`}
      className={`${styles.loadingPanel} public-directory-card public-panel`}
      id={`panel-${view}`}
      role="tabpanel"
    >
      <div className={`${styles.loadingMessage} public-empty`} role="alert">
        <strong>No se pudo cargar {label}</strong>
        <br />
        <span>La información territorial sigue disponible. Intenta cargar nuevamente esta vista.</span>
        <br />
        <button className="public-clear-button" onClick={onRetry} type="button">Reintentar</button>
      </div>
    </section>
  )
}

const PublicPeopleView = lazy(() => import('./PublicPeopleView'))
const PublicPastoralView = lazy(() => import('./PublicPastoralView'))
const PublicAdministrativeView = lazy(() => import('./PublicAdministrativeView'))
const PublicCollegialView = lazy(() => import('./PublicCollegialView'))

export default function PublicDashboardExplorer(props: Props) {
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
    activeMeta,
    deferredDataPending,
    deferredDataError,
    retryDeferredData,
    resetScope,
  } = model

  return (
    <>
      <section className="public-panel public-filter-panel" aria-labelledby="ambito-title">
        <div className="public-panel-title">
          <div className="public-heading-accent"><h1 id="ambito-title">Ámbito de consulta</h1></div>
          <button className="public-clear-button" onClick={resetScope} type="button">↻ Limpiar filtros</button>
        </div>
        <div className="public-filter-grid">
          <label>
            País
            <select value={country} onChange={(event) => { setCountry(event.target.value); resetScope() }}>
              {initialData.countries.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Provincia eclesiástica
            <select value={province} onChange={(event) => { setProvince(event.target.value); setJurisdictionId('') }}>
              <option value="">Todas las provincias</option>
              {provinces.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Jurisdicción
            <select value={jurisdictionId} onChange={(event) => setJurisdictionId(event.target.value)}>
              <option value="">Todas las jurisdicciones</option>
              {provinceDioceses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Vista activa
            <select value={activeView} onChange={(event) => setActiveView(event.target.value as PublicView)}>
              {views.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="public-tabs" role="tablist" aria-label="Vistas públicas">
        {views.map((view) => (
          <button
            aria-controls={`panel-${view.key}`}
            aria-selected={activeView === view.key}
            className={`public-tab ${activeView === view.key ? 'active' : ''}`}
            id={`tab-${view.key}`}
            key={view.key}
            onClick={() => setActiveView(view.key)}
            role="tab"
            type="button"
          >
            <span aria-hidden="true">{view.icon}</span>
            <span>{view.title}</span>
          </button>
        ))}
      </section>

      {activeView === 'territorial' && <PublicTerritorialView model={model} />}
      {deferredDataPending && <PublicViewLoading label={activeMeta.title.toLowerCase()} view={activeView} />}
      {deferredDataError && (
        <PublicViewError
          label={activeMeta.title.toLowerCase()}
          onRetry={retryDeferredData}
          view={activeView}
        />
      )}
      {activeView === 'clero' && !deferredDataPending && !deferredDataError && (
        <Suspense fallback={<PublicViewLoading label="clero y agentes" view="clero" />}>
          <PublicPeopleView model={model} />
        </Suspense>
      )}
      {activeView === 'pastoral' && !deferredDataPending && !deferredDataError && (
        <Suspense fallback={<PublicViewLoading label="organización pastoral" view="pastoral" />}>
          <PublicPastoralView model={model} />
        </Suspense>
      )}
      {activeView === 'administrativa' && !deferredDataPending && !deferredDataError && (
        <Suspense fallback={<PublicViewLoading label="organización administrativa" view="administrativa" />}>
          <PublicAdministrativeView model={model} />
        </Suspense>
      )}
      {activeView === 'colegial' && !deferredDataPending && !deferredDataError && (
        <Suspense fallback={<PublicViewLoading label="organismos colegiales" view="colegial" />}>
          <PublicCollegialView model={model} />
        </Suspense>
      )}
    </>
  )
}
