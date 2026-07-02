import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DiocesisPage() {
  const supabase = await createClient()
  void supabase

  return (
    <main className="container">
      <div className="page-heading">
        <p className="eyebrow">Directorio</p>
        <h1>Diocesis</h1>
        <p className="lead">Listado inicial.</p>
      </div>
    </main>
  )
}
