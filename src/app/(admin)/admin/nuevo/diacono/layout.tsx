import type { ReactNode } from 'react'
import '@/styles/person-wizard-ui.css'
import '@/styles/clergy-wizard-ui.css'

export default function DeaconWizardLayout({ children }: { children: ReactNode }) {
  return <div className="admin-deacon-wizard">{children}</div>
}
