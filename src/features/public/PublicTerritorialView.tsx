'use client'

import Link from 'next/link'
import { Empty, JurisdictionRow, Metric, PersonItem, formatNumber, isArchdiocese, isDiocese, isSpecial, slugify } from './PublicDashboardShared'
import type { PublicDashboardModel } from './usePublicDashboardModel'

export function PublicTerritorialView({ model }: { model: PublicDashboardModel }) {
  const {
    province,
    setProvince,
    setJurisdictionId,
    provinces,
    scopedDioceses,
    scopedParishes,
    ordinaryPeople,
    scopeTitle,
  } = model

  return (
    <section id="panel-territorial" role="tabpanel" aria-labelledby="tab-territorial">
      <section className="public-panel public-scope-card">
        <span className="public-country-mark" aria-hidden="true">▰</span>
        <div><h2>{scopeTitle}</h2><div className="public-scope-summary">
          <span>{scopedDioceses.filter((item) => !isSpecial(item)).length} jurisdicciones territoriales</span>
          <span>{scopedDioceses.filter(isSpecial).length} especiales</span>
          <span>{scopedParishes.length} parroquias cargadas</span>
        </div></div>
      </section>

      <section className="public-metrics-grid">
        <Metric label="Provincias" value={province ? 1 : provinces.length} detail="Agrupaciones metropolitanas" />
        <Metric label="Arquidiócesis" value={scopedDioceses.filter(isArchdiocese).length} detail="Sedes metropolitanas" />
        <Metric label="Diócesis" value={scopedDioceses.filter(isDiocese).length} detail="Jurisdicciones diocesanas" />
        <Metric label="Parroquias" value={formatNumber(scopedParishes.length)} detail="Registros publicados" />
      </section>

      <section className="public-content-grid public-country-content-grid">
        <article className="public-panel public-section-card">
          <div className="public-section-title"><p className="eyebrow">Provincias eclesiásticas</p><h2>Selecciona una provincia</h2></div>
          <div className="public-province-list">{provinces.map((item) => (
            <article className="public-province-card" key={item.name}>
              <span className="public-node-icon" aria-hidden="true">⌂</span>
              <button onClick={() => { setProvince(item.name); setJurisdictionId('') }} type="button"><strong>{item.name}</strong><span>{item.count} jurisdicciones</span></button>
              <Link className="public-link" href={`/provincias-eclesiasticas/${slugify(item.name)}`}>Ver ficha →</Link>
            </article>
          ))}</div>
        </article>

        <article className="public-panel public-section-card">
          <div className="public-section-title"><p className="eyebrow">Jurisdicciones</p><h2>{scopedDioceses.length} resultados</h2></div>
          <div className="public-table"><div className="public-table-head"><span>Jurisdicción</span><span>Tipo</span><span>Acción</span></div>
            {scopedDioceses.slice(0, 12).map((item) => <JurisdictionRow item={item} key={item.id} />)}
            <div className="public-list-footer"><Link className="public-link" href={province ? `/diocesis?provincia=${encodeURIComponent(province)}` : '/diocesis'}>Ver directorio completo →</Link></div>
          </div>
        </article>

        <article className="public-panel public-section-card">
          <div className="public-section-title"><p className="eyebrow">Pastores</p><h2>Obispos y ordinarios</h2></div>
          <div className="public-directory-grid">{ordinaryPeople.length === 0
            ? <Empty title="Sin ordinarios publicados" detail="No hay responsables activos asociados a este ámbito." />
            : ordinaryPeople.slice(0, 12).map((item) => <PersonItem item={item} key={item.id} />)}
          </div>
        </article>
      </section>
    </section>
  )
}
