'use client'

import { lazy, Suspense } from 'react'
import type { PublicView } from '@/lib/public/dashboard'
import styles from './PublicDashboardExplorer.module.css'
import { views, type Props } from './PublicDashboardShared'
import { PublicSearchableSelect } from './PublicSearchableSelect'
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

  const countryOptions = [
    { value: '', label: 'Todos los países' },
    ...initialData.countries.map((item) => ({ value: item.key, label: item.name })),
  ]
  const provinceOptions = [
    { value: '', label: country ? 'Todas las provincias' : 'Selecciona primero un país' },
    ...provinces.map((item) => ({ value: item.name, label: item.name })),
  ]
  const jurisdictionOptions = [
    { value: '', label: 'Todas las jurisdicciones' },
    ...provinceDioceses.map((item) => ({ value: item.id, label: item.name })),
  ]

  return (
    <>
      <section className="public-panel public-filter-panel" aria-labelledby="ambito-title" id="explorador">
        <div className="public-panel-title">
          <div className="public-heading-accent"><h2 id="ambito-title">Explorador eclesial</h2></div>
          <button className="public-clear-button" onClick={resetScope} type="button">↻ Limpiar filtros</button>
        </div>
        <div className="public-filter-grid">
          <PublicSearchableSelect
            label="País"
            onChange={(nextCountry) => {
              setCountry(nextCountry)
              setProvince('')
              setJurisdictionId('')
            }}
            options={countryOptions}
            placeholder="Buscar país"
            value={country}
          />
          <PublicSearchableSelect
            disabled={!country}
            label="Provincia eclesiástica"
            onChange={(nextProvince) => {
              setProvince(nextProvince)
              setJurisdictionId('')
            }}
            options={provinceOptions}
            placeholder={country ? 'Buscar provincia' : 'Selecciona primero un país'}
            value={province}
          />
          <PublicSearchableSelect
            label="Jurisdicción"
            onChange={setJurisdictionId}
            options={jurisdictionOptions}
            placeholder="Buscar jurisdicción"
            value={jurisdictionId}
          />
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
