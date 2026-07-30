import Link from 'next/link'
import styles from './PublicBreadcrumbs.module.css'

export type PublicBreadcrumbItem = {
  label: string
  href?: string
}

export function PublicBreadcrumbs({ items }: { items: PublicBreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li className={styles.item} key={`${item.label}-${index}`}>
              {item.href && !current
                ? <Link href={item.href}>{item.label}</Link>
                : <span aria-current={current ? 'page' : undefined} className={current ? styles.current : undefined}>{item.label}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
