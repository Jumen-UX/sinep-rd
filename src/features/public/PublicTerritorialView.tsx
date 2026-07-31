'use client'

import Link from 'next/link'
import { Empty, JurisdictionRow, Metric, PersonItem, formatNumber, isArchdiocese, isDiocese, isSpecial, slugify } from './PublicDashboardShared'
import type { PublicDashboardModel } from './usePublicDashboardModel'

export function PublicTerritorialView({ model }: { model: PublicDashboardModel }) {
  const {
    initialData,
    country,
    province,
    setProvince,
    setJurisdictionId,
    provinces,
    scopedDioceses,
    scopedParishes,
    ordinaryPeople,
    scopeTitle,
  } = model
  const territorialDioceses = scopedDioceses.filter((item) => !isSpecial(item))
  const specialDioceses = scopedDioceses.filter(isSpecial)
  const globalScope = !country
  const directoryParams = new URLSearchParams()
  if (country) directoryParams.set('pais', country)
  if (province) directoryParams.set('provincia', province)
  const directoryHref = directoryParams.size > 0 ? `/diocesis?${directoryParams.toString()}` : '/diocesis'

  return (
    <section className="public-territorial-view" id="panel-territorial" role="tabpanel" aria-labelledby="tab-territorial">
      <section className="public-panel public-scope-card">
        <span className="public-country-mark" aria-hidden="true">▰</span>
        <div><h2>{scopeTitle}</h2><div className="public-scope-summary">
          {globalScope ? <span>{initialData.countries.length} países con catálogo público</span> : null}
          <span>{territorialDioceses.length} jurisdicciones territoriales</span>
          <span>{specialDioceses.length} especiales</span>
          <span>{scopedParishes.length} parroquias cargadas</span>
        </div></div>
      </section>

      <section className="public-metrics-grid" aria-label={`Resumen territorial de ${scopeTitle}`}>
        <Metric
          detail={globalScope ? 'Catálogos nacionales disponibles' : 'Agrupaciones metropolitanas'}
          label={globalScope ? 'Países' : 'Provincias'}
          value={globalScope ? initialData.countries.length : province ? 1 : provinces.length}
        />
        <Metric label="Arquidiócesis" value={scopedDioceses.filter(isArchdiocese).length} detail="Sedes metropolitanas" />
        <Metric label="Diócesis" value={scopedDioceses.filter(isDiocese).length} detail="Jurisdicciones diocesanas" />
        <Metric label="Especiales" value={specialDioceses.length} detail="Ordinariatos y jurisdicciones personales" />
        <Metric label="Parroquias" value={formatNumber(scopedParishes.length)} detail="Registros publicados" />
      </section>

      <section className="public-territorial-sections" aria-label="Resumen territorial">
        <article className="public-panel public-section-card public-provinces-section">
          <div className="public-section-title">
            <p className="eyebrow">Provincias eclesiásticas</p>
            <h2>{globalScope ? 'Selecciona un país' : 'Selecciona una provincia'}</h2>
          </div>
          <div className="public-province-list">{globalScope
            ? <Empty title="Consulta por país" detail="Selecciona un país en el explorador para ver sus provincias eclesiásticas sin mezclar territorios homónimos." />
            : provinces.length === 0
              ? <Empty title="Sin provincias publicadas" detail="El país seleccionado todavía no tiene provincias eclesiásticas públicas registradas." />
              : provinces.map((item) => (
                <article className="public-province-card" key={item.name}>
                  <span className="public-node-icon" aria-hidden="true">⌂</span>
                  <button onClick={() => { setProvince(item.name); setJurisdictionId('') }} type="button"><strong>{item.name}</strong><span>{item.count} jurisdicciones</span></button>
                  <Link className="public-link" href={`/provincias-eclesiasticas/${slugify(item.name)}`}>Ver ficha →</Link>
                </article>
              ))}</div>
        </article>

        <article className="public-panel public-section-card public-jurisdictions-section">
          <div className="public-section-title"><p className="eyebrow">Jurisdicciones</p><h2>{scopedDioceses.length} resultados</h2></div>
          <div className="public-table">
            <div className="public-table-head"><span>Jurisdicción</span><span>Tipo</span><span>Acción</span></div>
            {scopedDioceses.length === 0
              ? <Empty title="Sin jurisdicciones publicadas" detail="No hay arquidiócesis, diócesis u otras jurisdicciones públicas para este ámbito." />
              : scopedDioceses.slice(0, 12).map((item) => <JurisdictionRow item={item} key={item.id} showCountry={globalScope} />)}
            <div className="public-list-footer"><Link className="public-link" href={directoryHref}>Ver directorio completo →</Link></div>
          </div>
        </article>

        <article className="public-panel public-section-card public-pastors-section">
          <div className="public-section-title"><p className="eyebrow">Pastores</p><h2>Obispos y ordinarios</h2></div>
          <div className="public-directory-grid public-pastors-grid">{ordinaryPeople.length === 0
            ? <Empty title="Sin ordinarios publicados" detail="No hay responsables activos asociados a este ámbito." />
            : ordinaryPeople.slice(0, 12).map((item) => <PersonItem item={item} key={item.id} />)}
          </div>
        </article>
      </section>
    </section>
  )
}
