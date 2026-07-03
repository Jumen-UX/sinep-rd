import CanonicalHelpHydrator from '@/components/CanonicalHelpHydrator'

export default function CanonicalHelperLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CanonicalHelpHydrator />
    </>
  )
}
