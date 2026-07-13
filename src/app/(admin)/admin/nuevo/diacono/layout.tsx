import type { ReactNode } from 'react'
import AutoSectionWizard from '@/components/admin/AutoSectionWizard'
import '@/styles/person-wizard-ui.css'
import '@/styles/deacon-wizard-ui.css'
import '@/styles/deacon-wizard-polish.css'

export default function DeaconWizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-deacon-wizard">
      <AutoSectionWizard>{children}</AutoSectionWizard>
    </div>
  )
}
