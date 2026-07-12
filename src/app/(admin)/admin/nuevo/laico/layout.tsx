import type { ReactNode } from 'react'
import '@/styles/person-wizard-ui.css'

export default function LayPersonWizardLayout({ children }: { children: ReactNode }) {
  return <div className="admin-lay-wizard">{children}</div>
}
