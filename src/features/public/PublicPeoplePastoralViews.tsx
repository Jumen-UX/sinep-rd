'use client'

import Link from 'next/link'
import { Empty, Metric, PastoralItem, PersonItem } from './PublicDashboardShared'
import type { PublicDashboardModel } from './usePublicDashboardModel'

export function PublicPeopleView({ model }: { model: PublicDashboardModel }) {
  const { personType, setPersonType, initialSummary, peopleBase, visiblePeople, scopeTitle, activeMeta } = model
  const count = (type: string) => peopleBase.filter((item) => item.personType === type).length

  return (
    <section className="public-directory-card public-panel" id="panel-clero" role="tabpanel" aria-labelledby="tab-clero">
      <div className="public-section-title"><p className="eyebrow">Personas</p><h2>Clero y agentes en {scopeTitle}</h2><p>{activeMeta.description}</p></div>
      <section className="public-metrics-grid">
        <Metric label="Obispos" value={count('bishop')} detail="Según el ámbito" onClick={() => setPersonType(personType === 'bishop' ? '' : 'bishop')} active={personType === 'bishop'} />
        <Metric label="Sacerdotes" value={count('priest')} detail="Registros publicados" onClick={() => setPersonType(personType === 'priest' ? '' : 'priest')} active={personType === 'priest'} />
        <Metric label="Diáconos" value={count('deacon')} detail="Registros publicados" onClick={() => setPersonType(personType === 'deacon' ? '' : 'deacon')} active={personType === 'deacon'} />
        <Metric label="Vida consagrada" value={initialSummary.people.religious} detail="Categoría transversal" />
        <Metric label="Laicos/as" value={count('layperson')} detail="Agentes publicados" onClick={() => setPersonType(personType === 'layperson' ? '' : 'layperson')} active={personType === 'layperson'} />
      </section>
      <div className="public-directory-grid">{visiblePeople.length === 0
        ? <Empty title="Sin personas publicadas" detail="No hay asignaciones vigentes para este ámbito y filtro." />
        : visiblePeople.map((item) => <PersonItem item={item} key={`${item.id}-${item.role}`} />)}
      </div>
      <div className="public-list-footer"><Link className="public-link" href={personType ? `/personas?tipo=${encodeURIComponent(personType)}` : '/personas'}>Abrir directorio de personas →</Link></div>
    </section>
  )
}

export function PublicPastoralView({ model }: { model: PublicDashboardModel }) {
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
        {pastoralGroups.map((group) => <Metric active={pastoralLevel === group.name} detail="Registros publicados" key={group.name} label={group.name} onClick={() => setPastoralLevel(pastoralLevel === group.name ? '' : group.name)} value={group.items.length} />)}
        {pastoralGroups.length === 0 && <Metric label="Parroquias" value={scopedParishes.length} detail="Sin niveles pastorales adicionales" />}
      </section>
      <div className="public-directory-grid">
        {scopedPastoral.filter((item) => !pastoralLevel || item.organization_chart_name === pastoralLevel).slice(0, 24).map((item) => <PastoralItem item={item} key={item.id} />)}
        {scopedPastoral.length === 0 && scopedParishes.slice(0, 24).map((item) => item.slug ? <Link className="public-directory-item" href={`/entidades/${item.slug}`} key={item.id}><strong>{item.name ?? 'Parroquia'}</strong><span>{item.diocese_name ?? scopeTitle}</span><span className="public-link">Ver ficha →</span></Link> : null)}
        {scopedPastoral.length === 0 && scopedParishes.length === 0 && <Empty title="Estructura pastoral sin publicar" detail="No hay niveles ni parroquias visibles para este ámbito." />}
      </div>
    </section>
  )
}
