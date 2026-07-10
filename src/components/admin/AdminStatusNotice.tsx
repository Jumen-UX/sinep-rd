import type { ReactNode } from 'react'

type NoticeTone = 'error' | 'warning' | 'info' | 'success' | 'empty'

type AdminStatusNoticeProps = {
  tone?: NoticeTone
  title: string
  description?: string
  action?: ReactNode
}

const toneClass: Record<NoticeTone, string> = {
  error: 'error-box',
  warning: 'admin-warning-box',
  info: 'admin-info-box',
  success: 'success-box',
  empty: 'empty-state',
}

export default function AdminStatusNotice({ tone = 'info', title, description, action }: AdminStatusNoticeProps) {
  return (
    <div className={toneClass[tone]} role={tone === 'error' ? 'alert' : 'status'}>
      <div>
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      {action && <div className="admin-actions">{action}</div>}
    </div>
  )
}
