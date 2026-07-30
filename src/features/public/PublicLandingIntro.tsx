import Link from 'next/link'
import styles from './PublicLandingIntro.module.css'

export default function PublicLandingIntro() {
  return (
    <section className={styles.hero} aria-labelledby="public-landing-title">
      <div className={styles.copy}>
        <p className="eyebrow">Directorio y memoria institucional de la Iglesia</p>
        <h1 id="public-landing-title">Información eclesial organizada por país, jurisdicción y servicio pastoral</h1>
        <p className={styles.lead}>
          Consulta estructuras territoriales, personas, organismos, lugares e instituciones mediante fichas públicas
          conectadas con su contexto histórico y pastoral.
        </p>
        <div className={styles.actions}>
          <a className="button button-primary" href="#explorador">Explorar información</a>
          <Link className="button button-secondary" href="/diocesis">Ver diócesis</Link>
          <Link className="button button-secondary" href="/personas">Buscar personas</Link>
        </div>
      </div>

      <aside className={styles.scope} aria-label="Alcance de la plataforma">
        <strong>Cobertura progresiva</strong>
        <p>La base inicial corresponde a República Dominicana y está preparada para incorporar otros países y equipos editoriales nacionales.</p>
        <ul>
          <li>Jerarquía territorial y pastoral</li>
          <li>Históricos de incumbentes y nombramientos</li>
          <li>Instituciones, templos y medios asociados</li>
        </ul>
      </aside>
    </section>
  )
}
