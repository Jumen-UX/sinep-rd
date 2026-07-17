import type { ReactNode } from 'react'
import PersonWizardContextRail from '@/components/admin/PersonWizardContextRail'
import '@/styles/person-wizard-ui.css'
import '@/styles/person-registration-wizard.css'

export default function ReligiousWizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-religious-wizard person-wizard-with-context">
      <div className="person-wizard-primary">{children}</div>
      <PersonWizardContextRail
        title="Vida consagrada"
        description="La pertenencia religiosa se añade a una identidad única y puede coexistir con cualquier grado del Orden."
        dimensions={[
          'Identidad personal',
          'Tipo de vida consagrada',
          'Comunidad y provincia',
          'Profesión y estado canónico',
          'Servicio actual',
          'Cargo y visibilidad',
          'Datos de contacto',
        ]}
      />
    </div>
  )
}
