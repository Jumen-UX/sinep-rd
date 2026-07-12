import type { ReactNode } from 'react'
import '@/styles/person-wizard-ui.css'

export default function ReligiousWizardLayout({ children }: { children: ReactNode }) {
  return <div className="admin-religious-wizard">{children}</div>
}
