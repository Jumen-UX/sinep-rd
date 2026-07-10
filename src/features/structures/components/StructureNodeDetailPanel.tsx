'use client'

import type { StructureNodeDetail } from '../types'

type StructureNodeDetailPanelProps = {
  detail: StructureNodeDetail | null
  loading?: boolean
  error?: string | null
  onEdit?: () => void
  onClose?: () => void
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export function StructureNodeDetailPanel({ detail, loading = false, error = null, onEdit, onClose }: StructureNodeDetailPanelProps) {
  if (loading) {
    return <aside className="card structure-node-detail" aria-busy="true">Cargando ficha estructural...</aside>
  }

  if (error) {
    return <aside className="card structure-node-detail"><div className="error-box">{error}</div></aside>
  }

  if (!detail) {
    return (
      <aside className="card structure-node-detail">
        <p className="eyebrow">Ficha de la unidad</p>
        <h2>Selecciona un nodo</h2>
        <p className="meta">Aquí se mostrarán sus datos, vigencia, fuente, cargos e historial.</p>
      </aside>
    )
  }

  const { node, level, template, parent, allowed_offices: offices, current_assignments: assignments, history } = detail

  return (
    <aside className="card structure-node-detail" aria-label={`Ficha de ${node.name}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{level.name} · {template.name}</p>
          <h2>{node.name}</h2>
          <p className="meta">{node.official_name || node.description || 'Sin descripción registrada.'}</p>
        </div>
        <div className="catalog-level-actions">
          {onEdit && <button className="button button-primary" type="button" onClick={onEdit}>Editar ficha</button>}
          {onClose && <button className="button button-secondary" type="button" onClick={onClose}>Cerrar</button>}
        </div>
      </div>

      <div className="catalog-tabs">
        <div className="metric-card"><span>Nivel</span><strong>{level.level_order + 1}</strong><small>{level.scope}</small></div>
        <div className="metric-card"><span>Cargos permitidos</span><strong>{offices.length}</strong><small>{assignments.length} ocupados actualmente</small></div>
        <div className="metric-card"><span>Historial</span><strong>{history.assignment_count}</strong><small>nombramientos registrados</small></div>
        <div className="metric-card"><span>Relaciones</span><strong>{history.edge_count}</strong><small>vínculos jerárquicos</small></div>
      </div>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Datos generales</p><h3>Identificación y vigencia</h3></div></div>
        <dl className="detail-list">
          <div><dt>Unidad superior</dt><dd>{parent?.name ?? 'Raíz del catálogo'}</dd></div>
          <div><dt>Código</dt><dd>{node.code ?? '—'}</dd></div>
          <div><dt>Estado</dt><dd>{node.status}</dd></div>
          <div><dt>Visibilidad</dt><dd>{node.visibility}</dd></div>
          <div><dt>Inicio</dt><dd>{formatDate(node.start_date)}</dd></div>
          <div><dt>Fin</dt><dd>{formatDate(node.end_date)}</dd></div>
        </dl>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Fuente</p><h3>Respaldo documental</h3></div></div>
        <dl className="detail-list">
          <div><dt>Fuente</dt><dd>{node.source_name ?? 'Pendiente de documentar'}</dd></div>
          <div><dt>Verificada</dt><dd>{formatDate(node.source_checked_at)}</dd></div>
          <div><dt>Enlace</dt><dd>{node.source_url ? <a href={node.source_url} target="_blank" rel="noreferrer">Abrir fuente</a> : '—'}</dd></div>
        </dl>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Cargos</p><h3>Configuración permitida por nivel</h3></div></div>
        {offices.length === 0 ? <div className="empty-state">Este nivel todavía no tiene cargos configurados.</div> : (
          <div className="catalog-column">
            {offices.map((office) => (
              <article className="catalog-level" key={office.mapping_id}>
                <div className="catalog-level-header"><strong>{office.display_name}</strong>{office.is_default && <span className="catalog-badge">Predeterminado</span>}</div>
                <small>{office.description ?? office.key} · {office.requires_clergy ? 'Requiere clérigo' : 'Admite agentes según configuración'}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Ocupantes actuales</p><h3>Nombramientos vigentes</h3></div></div>
        {assignments.length === 0 ? <div className="empty-state">No hay nombramientos actuales vinculados a esta unidad.</div> : (
          <div className="catalog-column">
            {assignments.map((assignment) => (
              <article className="catalog-node" key={assignment.assignment_id}>
                <strong>{assignment.office_name}</strong>
                <span>{assignment.person_name ?? 'Vacante'}</span>
                <small>Desde {formatDate(assignment.start_date)} · {assignment.publication_status ?? assignment.record_status}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}
