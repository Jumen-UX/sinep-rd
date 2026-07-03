import CanonicalHelpHydrator from '@/components/CanonicalHelpHydrator'

export default function PersonasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CanonicalHelpHydrator />
    </>
  )
}
