import type { ReactNode } from 'react'

type NoticeTone = 'error' | 'warning' | 'info' | 'success' | 'empty'

type AdminStatusNoticeProps = {
  tone?: NoticeTone
  title: string
  description?: string
  action?: ReactNode
  busy?: boolean
  id?: string
}

const toneClass: Record<NoticeTone, string> = {
  error: 'error-box',
  warning: 'admin-warning-box',
  info: 'admin-info-box',
  success: 'success-box',
  empty: 'empty-state',
}

export default function AdminStatusNotice({
  tone = 'info',
  title,
  description,
  action,
  busy = false,
  id,
}: AdminStatusNoticeProps) {
  const isError = tone === 'error'

  return (
    <div
      aria-atomic="true"
      aria-busy={busy || undefined}
      aria-live={isError ? 'assertive' : 'polite'}
      className={toneClass[tone]}
      id={id}
      role={isError ? 'alert' : 'status'}
    >
      <div>
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      {action && <div className="admin-actions">{action}</div>}
    </div>
  )
}
