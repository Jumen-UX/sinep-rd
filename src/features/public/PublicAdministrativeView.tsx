'use client'

import Link from 'next/link'
import { Empty } from './PublicDashboardShared'
import type { PublicDashboardModel } from './usePublicDashboardModel'

export default function PublicAdministrativeView({ model }: { model: PublicDashboardModel }) {
  const { activeMeta, administrativeUnits } = model
  return (
    <section className="public-directory-card public-panel" id="panel-administrativa" role="tabpanel" aria-labelledby="tab-administrativa">
      <div className="public-section-title"><p className="eyebrow">Administración</p><h2>{activeMeta.title}</h2><p>{activeMeta.description}</p></div>
      <div className="public-directory-grid">{administrativeUnits.slice(0, 24).map((item) => (
        <Link className="public-directory-item" href={`/oficinas/${item.id}`} key={item.id}><strong>{item.name}</strong><span>{item.description ?? 'Unidad administrativa'}</span><span className="public-link">Ver ficha →</span></Link>
      ))}{administrativeUnits.length === 0 && <Empty title="Sin unidades administrativas publicadas" detail="Las oficinas aparecerán cuando tengan visibilidad pública." />}</div>
    </section>
  )
}
