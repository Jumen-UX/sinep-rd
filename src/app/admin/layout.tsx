import CanonicalHelpHydrator from '@/components/CanonicalHelpHydrator'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CanonicalHelpHydrator />
    </>
  )
}
