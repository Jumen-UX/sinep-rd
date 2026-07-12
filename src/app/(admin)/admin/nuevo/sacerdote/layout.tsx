import type { ReactNode } from 'react'
import '@/styles/person-wizard-ui.css'
import '@/styles/priest-wizard-ui.css'

export default function PriestWizardLayout({ children }: { children: ReactNode }) {
  return <div className="admin-priest-wizard">{children}</div>
}
