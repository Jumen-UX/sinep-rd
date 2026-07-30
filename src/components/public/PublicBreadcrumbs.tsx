import Link from 'next/link'

export type PublicBreadcrumbItem = {
  label: string
  href?: string
}

export function PublicBreadcrumbs({ items }: { items: PublicBreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className="detail-backlink">
      <ol className="public-breadcrumb-list">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !current
                ? <Link href={item.href}>{item.label}</Link>
                : <span aria-current={current ? 'page' : undefined}>{item.label}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
