'use client'

import Link from 'next/link'

type FlowItem = {
  title: string
  type: string
  description: string
  href: string
  status: string
  icon: string
  items: string[]
}

type FlowGroup = {
  title: string
  eyebrow: string
  description: string
  icon: string
  items: FlowItem[]
}

const flowGroups: FlowGroup[] = [
  {
    eyebrow: 'Personas y ministerio',
    title: 'Registrar historial de una persona',
    description: 'Flujos guiados para crear o completar fichas personales sin duplicar registros y dejando trazabilidad ministerial.',
    icon: '◉',
    items: [
      { title: 'Registrar diácono', type: 'Clero', description: 'Crear ficha de diácono permanente, transitorio o externo.', href: '/admin/nuevo/diacono', status: 'Disponible', icon: '◌', items: ['Persona base', 'Ordenación', 'Servicio'] },
      { title: 'Registrar sacerdote', type: 'Clero', description: 'Crear sacerdote nuevo o completar desde diácono existente.', href: '/admin/nuevo/sacerdote', status: 'Disponible', icon: '●', items: ['Perfil clerical', 'Incardinación', 'Cargo rápido'] },
      { title: 'Registrar obispo', type: 'Clero', description: 'Completar desde sacerdote existente o registrar obispo externo.', href: '/admin/nuevo/obispo', status: 'Disponible', icon: '◍', items: ['Sacerdote base', 'Ordenación episcopal', 'Oficio'] },
      { title: 'Registrar laico/a', type: 'Persona laica', description: 'Crear ficha laica con código interno propio y responsabilidad pastoral.', href: '/admin/nuevo/laico', status: 'Disponible', icon: '♙', items: ['Identidad', 'Servicio', 'Vinculación'] },
      { title: 'Registrar religioso/a', type: 'Vida consagrada', description: 'Crear ficha de persona consagrada no sacerdotal o religiosa.', href: '/admin/nuevo/religioso', status: 'Disponible', icon: '✦', items: ['Instituto', 'Tipo de vida', 'Asignación'] },
    ],
  },
  {
    eyebrow: 'Estructura eclesial',
    title: 'Registrar entidades y unidades',
    description: 'Asistentes para agregar jurisdicciones, parroquias y capillas usando país, dependencia canónica y estructura flexible.',
    icon: '▦',
    items: [
      { title: 'Registrar jurisdicción', type: 'Jurisdicción', description: 'Crear diócesis, arquidiócesis, ordinariato u otra jurisdicción.', href: '/admin/nuevo/jurisdiccion', status: 'Disponible', icon: '▥', items: ['País ISO', 'Tipo canónico', 'Dependencia'] },
      { title: 'Registrar parroquia', type: 'Parroquia', description: 'Crear parroquia dependiente de una jurisdicción y su árbol interno.', href: '/admin/nuevo/parroquia', status: 'Disponible', icon: '✚', items: ['Diócesis', 'Nivel padre', 'Ficha pública'] },
      { title: 'Registrar capilla', type: 'Capilla', description: 'Crear capilla dependiente de parroquia, sector u otra entidad existente.', href: '/admin/nuevo/capilla', status: 'Disponible', icon: '⌂', items: ['Entidad madre', 'Comunidad', 'Fuente'] },
    ],
  },
]

function FlowCard({ item }: { item: FlowItem }) {
  return (
    <Link className="admin-module-card is-active" href={item.href}>
      <div className="admin-module-card-head">
        <span className="admin-module-icon">{item.icon}</span>
        <span className="admin-status-pill active">{item.status}</span>
      </div>
      <p className="entity-type">{item.type}</p>
      <h3>{item.title}</h3>
      <p className="meta">{item.description}</p>
      <ul>
        {item.items.map((detail) => <li key={detail}>{detail}</li>)}
      </ul>
      <span className="admin-module-action">Iniciar asistente <span aria-hidden="true">→</span></span>
    </Link>
  )
}

export default function AdminNuevoPage() {
  const totalFlows = flowGroups.reduce((total, group) => total + group.items.length, 0)

  return (
    <main className="admin-create-hub" id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">REGISTRO</span>
          <strong>Asistentes de nueva ficha</strong>
        </div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin">Volver al panel</Link>
          <Link className="button button-secondary" href="/admin/estructura">Configurar estructura</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Trabajo guiado</p>
          <h1>¿Qué quieres registrar?</h1>
          <p className="lead">Elige el asistente correcto para registrar personas o entidades con validaciones, catálogos y jerarquía flexible.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">{totalFlows} flujos disponibles</span>
            <span className="role-pill">Antiduplicados</span>
            <span className="role-pill">Trazabilidad</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">＋</div>
      </section>

      {flowGroups.map((group) => (
        <section className="admin-module-group" key={group.title}>
          <div className="admin-group-heading">
            <span>{group.icon}</span>
            <div>
              <p className="eyebrow">{group.eyebrow}</p>
              <h2>{group.title}</h2>
              <p className="meta">{group.description}</p>
            </div>
            <Link href="#top">Subir</Link>
          </div>

          <div className="admin-module-grid">
            {group.items.map((item) => <FlowCard item={item} key={item.href} />)}
          </div>
        </section>
      ))}
    </main>
  )
}
