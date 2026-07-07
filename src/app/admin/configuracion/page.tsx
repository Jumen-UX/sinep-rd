'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ConfigCard = {
  href: string
  label: string
  title: string
  description: string
}

const configSections: { title: string; description: string; items: ConfigCard[] }[] = [
  {
    title: 'Usuarios y seguridad',
    description: 'Controla accesos administrativos, roles, permisos efectivos y estados de cuenta.',
    items: [
      {
        href: '/admin/usuarios',
        label: 'Acceso',
        title: 'Usuarios, roles y permisos',
        description: 'Ver usuarios, activar o suspender cuentas, asignar niveles de acceso y cerrar roles activos.',
      },
    ],
  },
  {
    title: 'Cargos, oficios y nombramientos',
    description: 'Define cómo se llaman los cargos, quién puede ejercerlos y en qué ámbito se usan.',
    items: [
      {
        href: '/admin/cargos',
        label: 'Cargos',
        title: 'Cargos y oficios',
        description: 'Administrar cargos como párroco, administrador parroquial, vicario general, obispo auxiliar o director de pastoral.',
      },
      {
        href: '/admin/referencias-canonicas/cargos',
        label: 'Ayuda',
        title: 'Referencias canónicas',
        description: 'Consultar referencias y definiciones para orientar el uso correcto de los cargos.',
      },
    ],
  },
  {
    title: 'Estructura institucional',
    description: 'Organiza diócesis, parroquias, zonas, vicarías, pastorales y unidades administrativas.',
    items: [
      {
        href: '/admin/estructura',
        label: 'Estructura',
        title: 'Estructura territorial, pastoral y administrativa',
        description: 'Administrar cómo se ordenan las entidades y divisiones de cada jurisdicción.',
      },
      {
        href: '/admin/organigramas',
        label: 'Organigrama',
        title: 'Organigramas visuales',
        description: 'Ver unidades, responsables actuales y áreas sin responsable asignado.',
      },
    ],
  },
  {
    title: 'Control editorial',
    description: 'Revisa cambios, datos incompletos y solicitudes antes de publicarlos.',
    items: [
      {
        href: '/admin/solicitudes',
        label: 'Revisión',
        title: 'Solicitudes de cambio',
        description: 'Aprobar o rechazar cambios sugeridos por editores o usuarios autorizados.',
      },
      {
        href: '/admin/estado-fichas',
        label: 'Calidad',
        title: 'Estado de fichas',
        description: 'Revisar campos faltantes, datos no identificados y fichas incompletas.',
      },
    ],
  },
]

export default function AdminConfiguracionPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/admin/login')
        return
      }
      setLoading(false)
    }

    checkSession()
  }, [router, supabase])

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando configuración...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Ajustes del sistema</h1>
          <p className="lead">
            Aquí se agrupan los ajustes que definen cómo funciona SINEP RD. Son cambios de estructura, cargos y reglas de uso, no registros diarios.
          </p>
        </div>
      </section>

      {configSections.map((section) => (
        <section className="card admin-section" key={section.title}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{section.title}</p>
              <h2>{section.description}</h2>
            </div>
          </div>

          <div className="grid admin-modules">
            {section.items.map((item) => (
              <Link className="entity-card admin-module" href={item.href} key={item.href}>
                <p className="entity-type">{item.label}</p>
                <h2>{item.title}</h2>
                <p className="meta">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
