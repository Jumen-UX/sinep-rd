'use client'

import Link from 'next/link'

type FlowItem = {
  title: string
  type: string
  description: string
  href: string
  status: string
}

type FlowGroup = {
  title: string
  eyebrow: string
  description: string
  items: FlowItem[]
}

const flowGroups: FlowGroup[] = [
  {
    eyebrow: 'Personas y ministerio',
    title: 'Registrar historial de una persona',
    description: 'Usa estos flujos para crear o completar fichas sin duplicar personas.',
    items: [
      { title: 'Registrar diácono', type: 'Clero', description: 'Crear ficha de diácono permanente, transitorio o externo.', href: '/admin/nuevo/diacono', status: 'Disponible' },
      { title: 'Registrar sacerdote', type: 'Clero', description: 'Crear sacerdote nuevo o completar desde diácono existente.', href: '/admin/nuevo/sacerdote', status: 'Disponible' },
      { title: 'Registrar obispo', type: 'Clero', description: 'Completar desde sacerdote existente o registrar obispo externo.', href: '/admin/nuevo/obispo', status: 'Disponible' },
      { title: 'Registrar laico/a', type: 'Persona laica', description: 'Crear ficha laica con código interno propio.', href: '/admin/nuevo/laico', status: 'Disponible' },
      { title: 'Registrar religioso/a', type: 'Vida consagrada', description: 'Crear ficha de persona consagrada no sacerdotal.', href: '/admin/nuevo/religioso', status: 'Disponible' },
    ],
  },
  {
    eyebrow: 'Estructura eclesial',
    title: 'Registrar entidades',
    description: 'Usa estos flujos para agregar jurisdicciones, parroquias o capillas.',
    items: [
      { title: 'Registrar jurisdicción', type: 'Jurisdicción', description: 'Crear diócesis, arquidiócesis u ordinariato.', href: '/admin/nuevo/jurisdiccion', status: 'Disponible' },
      { title: 'Registrar parroquia', type: 'Parroquia', description: 'Crear parroquia dependiente de una jurisdicción.', href: '/admin/nuevo/parroquia', status: 'Disponible' },
      { title: 'Registrar capilla', type: 'Capilla', description: 'Crear capilla dependiente de una entidad existente.', href: '/admin/nuevo/capilla', status: 'Disponible' },
    ],
  },
]

export default function AdminNuevoPage() {
  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente de registro</p>
          <h1>¿Qué quieres registrar?</h1>
          <p className="lead">Elige el flujo correcto para registrar personas o entidades.</p>
        </div>
      </section>

      {flowGroups.map((group) => (
        <section className="card admin-section" key={group.title}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{group.eyebrow}</p>
              <h2>{group.title}</h2>
              <p className="meta">{group.description}</p>
            </div>
          </div>

          <div className="grid admin-modules">
            {group.items.map((item) => (
              <article className="entity-card admin-module" key={item.title}>
                <p className="entity-type">{item.type}</p>
                <h2>{item.title}</h2>
                <p className="meta">{item.description}</p>
                <p className="role-pill">{item.status}</p>
                <Link className="button button-primary" href={item.href}>Iniciar asistente</Link>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
