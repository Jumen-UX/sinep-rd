import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Información sobre el tratamiento y la publicación de datos en SINEP RD.',
}

export default function PrivacyPage() {
  return (
    <main className="container legal-page">
      <header>
        <p className="eyebrow">Información institucional</p>
        <h1>Política de privacidad</h1>
        <p className="lead">SINEP RD publica información eclesial y pastoral de interés institucional y protege los datos reservados usados para validación y administración.</p>
      </header>

      <section aria-labelledby="datos-publicos">
        <h2 id="datos-publicos">Datos públicos</h2>
        <p>Las fichas públicas pueden mostrar nombres, funciones eclesiales, jurisdicciones, asignaciones, reseñas biográficas, fotografías y fuentes documentales cuando hayan sido autorizadas para publicación.</p>
      </section>

      <section aria-labelledby="datos-reservados">
        <h2 id="datos-reservados">Datos reservados</h2>
        <p>Los documentos de identidad, datos familiares, contactos privados, notas internas, credenciales y registros administrativos no deben exponerse en el portal público. Su acceso está limitado por autenticación, permisos y alcance jurisdiccional.</p>
      </section>

      <section aria-labelledby="finalidad">
        <h2 id="finalidad">Finalidad y conservación</h2>
        <p>La información se utiliza para mantener un directorio e historial eclesial verificable, gestionar nombramientos y apoyar la revisión editorial. Los datos se conservan según su valor institucional, histórico y las obligaciones aplicables.</p>
      </section>

      <section aria-labelledby="derechos">
        <h2 id="derechos">Correcciones y consultas</h2>
        <p>Las solicitudes de corrección pueden enviarse mediante el formulario de sugerencias disponible en las fichas públicas. Las solicitudes sobre datos reservados deben tramitarse ante la administración responsable de SINEP RD.</p>
      </section>

      <p className="meta">Última actualización: 10 de julio de 2026. Este texto debe ser validado por la autoridad institucional responsable antes del lanzamiento formal.</p>
    </main>
  )
}
