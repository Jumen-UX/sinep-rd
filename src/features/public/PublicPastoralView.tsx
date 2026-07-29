'use client'

import Link from 'next/link'
import { Empty, Metric, PastoralItem } from './PublicDashboardShared'
import type { PublicDashboardModel } from './usePublicDashboardModel'

export default function PublicPastoralView({ model }: { model: PublicDashboardModel }) {
  const {
    pastoralLevel,
    setPastoralLevel,
    pastoralGroups,
    scopedPastoral,
    scopedParishes,
    scopeTitle,
    activeMeta,
  } = model

  return (
    <section className="public-directory-card public-panel" id="panel-pastoral" role="tabpanel" aria-labelledby="tab-pastoral">
      <div className="public-section-title"><p className="eyebrow">Pastoral</p><h2>Organización pastoral en {scopeTitle}</h2><p>{activeMeta.description}</p></div>
      <section className="public-metrics-grid">
        {pastoralGroups.map((group) => <Metric active={pastoralLevel === group.name} detail="Unidades publicadas" key={group.name} label={group.name} onClick={() => setPastoralLevel(pastoralLevel === group.name ? '' : group.name)} value={group.items.length} />)}
        {pastoralGroups.length === 0 && <Metric label="Parroquias" value={scopedParishes.length} detail="Sin organigramas adicionales" />}
      </section>
      <div className="public-directory-grid">
        {scopedPastoral.filter((item) => !pastoralLevel || item.organization_chart_name === pastoralLevel).slice(0, 24).map((item) => <PastoralItem item={item} key={item.id} />)}
        {scopedPastoral.length === 0 && scopedParishes.slice(0, 24).map((item) => item.slug ? <Link className="public-directory-item" href={`/entidades/${item.slug}`} key={item.id}><strong>{item.name ?? 'Parroquia'}</strong><span>{item.diocese_name ?? scopeTitle}</span><span className="public-link">Ver ficha →</span></Link> : null)}
        {scopedPastoral.length === 0 && scopedParishes.length === 0 && <Empty title="Estructura pastoral sin publicar" detail="No hay unidades organizativas ni parroquias visibles para este ámbito." />}
      </div>
    </section>
  )
}
