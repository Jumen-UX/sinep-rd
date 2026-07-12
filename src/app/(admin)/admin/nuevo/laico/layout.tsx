import type { ReactNode } from 'react'
import PersonWizardContextRail from '@/components/admin/PersonWizardContextRail'
import '@/styles/person-wizard-ui.css'

export default function LayPersonWizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-lay-wizard person-wizard-with-context">
      <div className="person-wizard-primary">{children}</div>
      <PersonWizardContextRail
        title="Agente laico"
        description="La condición laical se deriva del estado sacramental; el sistema registra por separado identidad, servicio y responsabilidades."
        dimensions={[
          'Identidad personal',
          'Datos biográficos',
          'Contacto y familia',
          'Formación o ministerio',
          'Servicio pastoral',
          'Cargo y visibilidad',
          'Fuentes y validación',
        ]}
      />
    </div>
  )
}
