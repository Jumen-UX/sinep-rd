import type { ReactNode } from 'react'
import AdminShell from './AdminShell'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .site-shell > .site-header,
        .site-shell > .site-footer{display:none}
        .admin-area{min-height:100vh;background:#fbfaf7}
        .admin-redesign{align-items:start}
        .admin-sidebar{gap:18px;grid-template-rows:auto minmax(0,1fr) auto;padding:22px 16px}
        .admin-brand-block{padding:0 4px 12px}
        .admin-brand-shield{border-radius:14px;flex-basis:46px;height:46px;width:46px}
        .admin-sidebar-nav{align-content:start;align-items:start;display:grid;gap:18px;grid-auto-rows:min-content;overflow-y:auto;padding:2px 4px 6px;scrollbar-width:thin}
        .admin-sidebar-section{display:grid;gap:7px}
        .admin-sidebar-section > p{color:var(--muted);font-size:10px;font-weight:950;letter-spacing:.12em;margin:0;padding:0 12px;text-transform:uppercase}
        .admin-sidebar-section > div{display:grid;gap:5px}
        .admin-sidebar-nav a{align-items:center;border:1px solid transparent;border-left:4px solid transparent;border-radius:14px;display:grid;gap:10px;grid-template-columns:24px minmax(0,1fr);min-height:54px;padding:9px 10px}
        .admin-sidebar-nav a:first-child{background:transparent;border-left-color:transparent}
        .admin-sidebar-nav a[aria-current='page']{background:#fff8ea;border-color:rgba(255,192,3,.45);border-left-color:var(--primary);box-shadow:0 10px 26px rgba(31,41,51,.06)}
        .admin-sidebar-nav a:hover,.admin-sidebar-nav a:focus-visible{background:#fff8ea;border-color:rgba(179,139,45,.25);border-left-color:var(--primary);transform:translateX(2px)}
        .admin-sidebar-nav a > span:first-child{background:#fff3cf;border-radius:10px;color:var(--primary);font-size:14px;height:26px;width:26px}
        .admin-sidebar-nav strong{font-size:13px;line-height:1.15}
        .admin-sidebar-nav small{font-size:11px;line-height:1.25;margin-top:1px}
        .admin-sidebar-help{border-radius:16px;gap:6px;padding:12px}
        .admin-sidebar-help > span{font-size:18px}
        .admin-sidebar-help strong{font-size:13px}
        .admin-sidebar-help small{font-size:11px;line-height:1.3}
        .admin-sidebar-help a{font-size:12px;min-height:34px}
        .admin-sidebar-nav a,
        .admin-brand-block,
        .admin-quick-card,
        .admin-module-card.is-active,
        .admin-stat-strip a,
        .admin-section-top-link,
        .admin-system-card a{cursor:pointer;pointer-events:auto;position:relative;z-index:3}
        .admin-quick-card > *,
        .admin-module-card.is-active > *,
        .admin-stat-strip a > *,
        .admin-sidebar-nav a > *,
        .admin-brand-block > *{pointer-events:none}
        .admin-module-card::before{pointer-events:none}
        .admin-module-card.is-planned{cursor:not-allowed;pointer-events:none}
        .admin-workspace{position:relative;z-index:1}
        .admin-sidebar{position:relative;z-index:4}
        .admin-workspace > #top{display:grid;gap:22px}
        .admin-workspace > main.container{display:grid;gap:22px;margin:0;max-width:none;padding:0;width:100%}
        .admin-workspace > main.container .dashboard-hero{border-radius:28px;box-shadow:0 20px 58px rgba(31,41,51,.06)}
        .admin-workspace .detail-backlink{margin:0}
        .admin-workspace .detail-backlink a{color:var(--primary);font-weight:900;text-decoration-color:rgba(122,31,31,.35);text-underline-offset:4px}
        @media (min-width:1181px){
          .admin-sidebar{align-self:start;height:calc(100vh - 24px);overflow:hidden;position:sticky;top:12px}
          .admin-sidebar-nav{max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding-bottom:12px}
        }
        @media (max-width:1180px){
          .admin-redesign{align-items:stretch}.admin-sidebar{height:auto;overflow:visible;padding:16px;position:static;top:auto}.admin-sidebar-nav{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden}.admin-sidebar-section{flex:0 0 auto;min-width:210px}.admin-sidebar-section > div{display:flex}.admin-sidebar-nav a{flex:0 0 210px}.admin-sidebar-section > p{padding:0 2px 4px}
        }
      `}</style>
      <AdminShell>{children}</AdminShell>
    </>
  )
}
