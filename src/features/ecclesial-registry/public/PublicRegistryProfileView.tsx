import Link from 'next/link'
import { PublicBreadcrumbs } from '@/components/public/PublicBreadcrumbs'
import type {
  PublicInstitutionProfile,
  PublicPlaceProfile,
  PublicRegistryAffiliation,
} from '@/lib/public/ecclesial-registry-detail'

type Props = {
  data: PublicPlaceProfile | PublicInstitutionProfile
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function relationLabel(value: string) {
  const labels: Record<string, string> = {
    belongs_to: 'Pertenece a',
    seat_of: 'Sede de',
    owned_by: 'Propiedad de',
    administered_by: 'Administrado por',
    pastorally_served_by: 'Atendido pastoralmente por',
    pastorally_attached_to: 'Adscrito pastoralmente a',
    sponsored_by: 'Patrocinado por',
    operated_by: 'Operado por',
    used_by: 'Utilizado por',
    part_of: 'Forma parte de',
    located_within: 'Ubicado en',
  }
  return labels[value] ?? value.replaceAll('_', ' ')
}

function targetHref(item: PublicRegistryAffiliation) {
  if (!item.target_slug) return null
  if (item.target_kind === 'entity') return `/entidades/${item.target_slug}`
  if (item.target_kind === 'institution') return `/instituciones/${item.target_slug}`
  if (item.target_kind === 'organization_unit') return `/pastoral/${item.target_slug}`
  return null
}

function AffiliationList({ items }: { items: PublicRegistryAffiliation[] }) {
  if (items.length === 0) return <p className="meta">No hay relaciones públicas registradas.</p>
  return (
    <ul className="detail-list">
      {items.map((item) => {
        const href = targetHref(item)
        return (
          <li key={item.id}>
            <strong>{relationLabel(item.relationship_type)}</strong>{' '}
            {href ? <Link href={href}>{item.target_name}</Link> : item.target_name}
            {(item.valid_from || item.valid_to) ? (
              <span className="meta"> · {formatDate(item.valid_from) ?? 'fecha inicial no registrada'} – {formatDate(item.valid_to) ?? 'actualidad'}</span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export default function PublicRegistryProfileView({ data }: Props) {
  const record = data.record
  const title = String(record.official_name || record.name)
  const current = data.affiliations.filter((item) => item.is_current)
  const history = data.affiliations.filter((item) => !item.is_current)
  const kindLabel = data.kind === 'place' ? data.type_name : data.category_name
  const parentItems = data.primary_entity_slug
    ? [{ label: data.primary_entity_name ?? 'Entidad principal', href: `/entidades/${data.primary_entity_slug}` }]
    : [{ label: 'Diócesis y jurisdicciones', href: '/diocesis' }]

  return (
    <main className="container dashboard-page registry-public-profile">
      <PublicBreadcrumbs items={[
        { label: 'Inicio', href: '/' },
        ...parentItems,
        { label: title },
      ]} />

      <header className="detail-hero">
        <p className="eyebrow">{kindLabel ?? (data.kind === 'place' ? 'Lugar eclesiástico' : 'Institución eclesial')}</p>
        <h1>{title}</h1>
        {record.description ? <p className="lead">{String(record.description)}</p> : null}
        {data.primary_entity_name ? (
          <p className="meta">
            Entidad principal:{' '}
            {data.primary_entity_slug ? <Link href={`/entidades/${data.primary_entity_slug}`}>{data.primary_entity_name}</Link> : data.primary_entity_name}
          </p>
        ) : null}
      </header>

      <section className="dashboard-card">
        <h2>Información principal</h2>
        <dl className="detail-grid">
          {record.address ? <><dt>Dirección</dt><dd>{String(record.address)}</dd></> : null}
          {record.municipality ? <><dt>Municipio</dt><dd>{String(record.municipality)}</dd></> : null}
          {record.country_iso2 ? <><dt>País</dt><dd>{String(record.country_iso2)}</dd></> : null}
          {record.dedication_title ? <><dt>Advocación</dt><dd>{String(record.dedication_title)}</dd></> : null}
          {record.patron_name ? <><dt>Patrono</dt><dd>{String(record.patron_name)}</dd></> : null}
          {record.founded_at ? <><dt>Fundación</dt><dd>{formatDate(record.founded_at)}</dd></> : null}
          {record.canonical_erected_at ? <><dt>Erección canónica</dt><dd>{formatDate(record.canonical_erected_at)}</dd></> : null}
          {record.dedicated_at ? <><dt>Dedicación</dt><dd>{formatDate(record.dedicated_at)}</dd></> : null}
          {record.consecrated_at ? <><dt>Consagración</dt><dd>{formatDate(record.consecrated_at)}</dd></> : null}
        </dl>
      </section>

      <section className="dashboard-card">
        <h2>Relaciones vigentes</h2>
        <AffiliationList items={current} />
      </section>

      {history.length > 0 ? (
        <details className="dashboard-card">
          <summary><strong>Ver historial de relaciones ({history.length})</strong></summary>
          <AffiliationList items={history} />
        </details>
      ) : null}

      {data.channels.length > 0 ? (
        <section className="dashboard-card">
          <h2>Contacto y medios</h2>
          <ul className="detail-list">
            {data.channels.map((channel) => (
              <li key={channel.id}><strong>{channel.label ?? 'Canal'}:</strong> {channel.value}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {(record.source_name || record.source_checked_at) ? (
        <footer className="meta source-note">
          Fuente: {String(record.source_name ?? 'registro institucional')}
          {record.source_checked_at ? ` · verificada el ${formatDate(record.source_checked_at)}` : ''}
        </footer>
      ) : null}
    </main>
  )
}