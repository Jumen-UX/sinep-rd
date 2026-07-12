import type { ReactNode } from 'react'
import PersonWizardContextRail from '@/components/admin/PersonWizardContextRail'
import '@/styles/person-wizard-ui.css'

export default function BishopWizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-bishop-wizard person-wizard-with-context">
      <div className="person-wizard-primary">{children}</div>
      <PersonWizardContextRail
        title="Registro episcopal"
        description="El asistente agrega el episcopado a una identidad existente o crea una identidad externa cuando corresponde."
        dimensions={[
          'Identidad personal',
          'Historia sacramental',
          'Función episcopal',
          'Estado canónico',
          'Dignidades',
          'Jurisdicción y cargo',
          'Fuentes',
        ]}
      />
    </div>
  )
}
