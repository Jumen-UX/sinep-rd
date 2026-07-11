import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso legal',
  description: 'Condiciones generales de uso de SINEP RD.',
}

export default function LegalNoticePage() {
  return (
    <main className="container legal-page">
      <header>
        <p className="eyebrow">Información institucional</p>
        <h1>Aviso legal</h1>
        <p className="lead">SINEP RD es un sistema de información eclesial y pastoral destinado a consulta, gestión y preservación histórica.</p>
      </header>

      <section aria-labelledby="exactitud">
        <h2 id="exactitud">Exactitud de la información</h2>
        <p>Las fichas pueden encontrarse en revisión o depender de fuentes externas. La información publicada no sustituye documentos canónicos, decretos, certificaciones ni comunicaciones oficiales de las autoridades competentes.</p>
      </section>

      <section aria-labelledby="uso">
        <h2 id="uso">Uso permitido</h2>
        <p>El contenido debe utilizarse respetando la dignidad de las personas, la finalidad institucional del sistema, la privacidad y los derechos aplicables sobre textos, imágenes y documentos.</p>
      </section>

      <section aria-labelledby="responsabilidad">
        <h2 id="responsabilidad">Responsabilidad editorial</h2>
        <p>Las correcciones y actualizaciones quedan sujetas a verificación. La autoridad institucional responsable deberá aprobar la versión definitiva de este aviso y aportar sus datos oficiales de contacto antes del lanzamiento formal.</p>
      </section>

      <p className="meta">Última actualización: 10 de julio de 2026.</p>
    </main>
  )
}
