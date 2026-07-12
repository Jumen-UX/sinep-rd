import type { ReactNode } from 'react'
import '@/styles/person-wizard-ui.css'

export default function BishopWizardLayout({ children }: { children: ReactNode }) {
  return <div className="admin-bishop-wizard">{children}</div>
}
