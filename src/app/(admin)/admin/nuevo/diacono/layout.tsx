import type { ReactNode } from 'react'
import '@/styles/deacon-wizard-ui.css'

export default function DeaconWizardLayout({ children }: { children: ReactNode }) {
  return <div className="admin-deacon-wizard">{children}</div>
}
