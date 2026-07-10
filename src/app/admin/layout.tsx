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
        .admin-stat-strip button,
        .admin-section-top-link,
        .admin-system-card a{cursor:pointer;pointer-events:auto;position:relative;z-index:3}
        .admin-quick-card > *,
        .admin-module-card.is-active > *,
        .admin-stat-strip a > *,
        .admin-sidebar-nav a > *,
        .admin-brand-block > *{pointer-events:none}
        .admin-stat-strip button{align-items:center;background:transparent;border:0;border-right:1px solid var(--border);color:inherit;display:grid;font:inherit;gap:7px;min-height:128px;padding:20px;text-align:left}
        .admin-stat-strip button:last-child{border-right:0}
        .admin-stat-strip button:hover,
        .admin-stat-strip button:focus-visible,
        .admin-stat-strip button.active-filter{background:#fff8ea;outline:none}
        .admin-stat-strip button:nth-child(2n) span{background:#fff1c7;color:var(--gold,#b38b2d)}
        .admin-stat-strip > div{align-items:center;border-right:1px solid var(--border);display:grid;gap:7px;min-height:128px;padding:20px}
        .admin-stat-strip > div:last-child{border-right:0}
        .admin-stat-strip > div:nth-child(2n) span{background:#fff1c7;color:var(--gold,#b38b2d)}
        .role-list button.role-pill{border:0;cursor:pointer;font:inherit}
        .role-list button.role-pill.active-filter{background:#fff8ea;color:var(--primary)}
        button.admin-module-card{font:inherit;text-align:left}
        button.admin-module-card.active-filter{background:#fff8ea;border-color:rgba(255,192,3,.85);box-shadow:0 12px 28px rgba(179,139,45,.12)}
        .admin-module-card::before{pointer-events:none}
        .admin-module-card.is-planned{cursor:not-allowed;pointer-events:none}
        .admin-workspace{position:relative;z-index:1}
        .admin-sidebar{position:relative;z-index:4}
        .admin-workspace > #top{display:grid;gap:22px}
        .admin-workspace > main.container{display:grid;gap:22px;margin:0;max-width:none;padding:0;width:100%}
        .admin-workspace > main.container .dashboard-hero{border-radius:28px;box-shadow:0 20px 58px rgba(31,41,51,.06)}
        .admin-workspace .detail-backlink{margin:0}
        .admin-workspace .detail-backlink a{color:var(--primary);font-weight:900;text-decoration-color:rgba(122,31,31,.35);text-underline-offset:4px}
        .admin-config-page > .dashboard-summary{display:grid;gap:10px;grid-template-columns:repeat(8,minmax(96px,1fr))}
        .admin-config-page > .dashboard-summary .metric-button{align-items:start;background:#fff;border:1px solid var(--border);border-radius:18px;box-shadow:0 10px 24px rgba(31,41,51,.045);display:grid;gap:8px;min-height:86px;padding:14px 16px;text-align:left;transition:border-color 160ms ease,box-shadow 160ms ease,transform 160ms ease}
        .admin-config-page > .dashboard-summary .metric-button strong{font-size:28px;line-height:1}
        .admin-config-page > .dashboard-summary .metric-button span{color:var(--muted);font-size:12px;font-weight:900;line-height:1.25}
        .admin-config-page > .dashboard-summary .metric-button.active-filter{background:#fff8ea;border-color:rgba(255,192,3,.85);box-shadow:0 12px 28px rgba(179,139,45,.12)}
        .admin-config-page > .dashboard-summary .metric-button:hover{border-color:rgba(179,139,45,.45);transform:translateY(-1px)}
        .admin-config-form.dashboard-section{border-radius:26px;display:grid;gap:20px;padding:clamp(20px,3vw,28px)}
        .admin-config-form.dashboard-section > section:not([hidden]){display:grid;gap:16px;max-width:980px}
        .admin-config-form.dashboard-section > section h2{margin:0}
        .admin-config-form.dashboard-section > section h2:not(:first-of-type){border-top:1px solid var(--border);margin-top:10px;padding-top:18px}
        .admin-config-form.dashboard-section input,
        .admin-config-form.dashboard-section select,
        .admin-config-form.dashboard-section textarea{background:#fff;border:1px solid var(--border);border-radius:14px;color:var(--foreground);font:inherit;min-height:48px;padding:12px 14px;width:100%}
        .admin-config-form.dashboard-section textarea{min-height:96px;resize:vertical}
        .admin-config-form.dashboard-section input:focus,
        .admin-config-form.dashboard-section select:focus,
        .admin-config-form.dashboard-section textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(255,192,3,.18);outline:none}
        .admin-config-form.dashboard-section label:not(.role-pill){color:var(--muted);display:grid;font-size:13px;font-weight:900;gap:8px}
        .admin-config-form.dashboard-section label.role-pill{align-items:center;background:#fff;border:1px solid var(--border);border-radius:18px;color:var(--foreground);display:grid;font-weight:900;gap:12px;grid-template-columns:24px minmax(0,1fr);line-height:1.35;margin:0;max-width:720px;padding:14px 16px;text-align:left;width:100%}
        .admin-config-form.dashboard-section label.role-pill:has(input:checked){background:#fff8ea;border-color:rgba(255,192,3,.85);box-shadow:0 10px 28px rgba(179,139,45,.12);color:var(--primary)}
        .admin-config-form.dashboard-section label.role-pill input{height:20px;min-height:20px;padding:0;width:20px}
        .admin-config-form.dashboard-section .empty-state{align-items:start;border-radius:18px;display:grid;gap:6px;justify-items:start;margin:2px 0;max-width:880px;text-align:left}
        .admin-config-form.dashboard-section .compact-section{border-radius:18px;display:grid;gap:12px;padding:16px}
        .admin-config-form.dashboard-section > .admin-form-grid{align-items:center;background:linear-gradient(180deg,rgba(255,255,255,.86),#fff);border-top:1px solid var(--border);bottom:0;display:flex;gap:12px;justify-content:flex-end;margin:8px -8px -8px;padding:16px 8px 0;position:sticky;z-index:7}
        .admin-config-form.dashboard-section > .admin-form-grid .button:first-child{margin-right:auto}
        main.admin-config-page:has(> form.admin-config-form){align-items:start;grid-template-columns:230px minmax(0,1fr);grid-template-areas:'back back' 'hero hero' 'steps form';column-gap:22px;row-gap:18px}
        main.admin-config-page:has(> form.admin-config-form) > .detail-backlink{grid-area:back}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-hero{grid-area:hero;padding:24px 28px}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-hero h1{font-size:clamp(38px,4vw,62px);margin-bottom:8px}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-hero .lead{font-size:16px;max-width:860px}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-summary{align-self:start;display:grid;gap:8px;grid-area:steps;grid-template-columns:1fr;position:sticky;top:20px}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-summary .metric-button{align-items:center;border-radius:14px;grid-template-columns:38px minmax(0,1fr);min-height:58px;padding:10px 12px}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-summary .metric-button strong{align-items:center;background:#fff3cf;border-radius:10px;color:var(--primary);display:flex;font-size:18px;height:34px;justify-content:center;width:34px}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-summary .metric-button span{font-size:13px}
        main.admin-config-page:has(> form.admin-config-form) > .dashboard-summary .metric-button.active-filter{border-left:4px solid var(--primary)}
        main.admin-config-page:has(> form.admin-config-form) > form.admin-config-form{grid-area:form;min-height:520px}
        main.admin-config-page:has(> form.admin-config-form) > .error-box,
        main.admin-config-page:has(> form.admin-config-form) > .success-box,
        main.admin-config-page:has(> form.admin-config-form) > .empty-state{grid-column:1/-1}
        @media (max-width:1380px){.admin-config-page > .dashboard-summary{grid-template-columns:repeat(4,minmax(120px,1fr))}}
        @media (min-width:1181px){
          .admin-sidebar{align-self:start;height:calc(100vh - 24px);overflow:hidden;position:sticky;top:12px}
          .admin-sidebar-nav{max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding-bottom:12px}
        }
        @media (max-width:1180px){
          .admin-redesign{align-items:stretch}.admin-sidebar{height:auto;overflow:visible;padding:16px;position:static;top:auto}.admin-sidebar-nav{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden}.admin-sidebar-section{flex:0 0 auto;min-width:210px}.admin-sidebar-section > div{display:flex}.admin-sidebar-nav a{flex:0 0 210px}.admin-sidebar-section > p{padding:0 2px 4px}.admin-config-page > .dashboard-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-config-form.dashboard-section > .admin-form-grid{position:static}main.admin-config-page:has(> form.admin-config-form){display:grid;grid-template-columns:1fr;grid-template-areas:'back' 'hero' 'steps' 'form'}main.admin-config-page:has(> form.admin-config-form) > .dashboard-summary{display:flex;overflow-x:auto;position:static}main.admin-config-page:has(> form.admin-config-form) > .dashboard-summary .metric-button{flex:0 0 150px}
        }
      `}</style>
      <AdminShell>{children}</AdminShell>
    </>
  )
}
