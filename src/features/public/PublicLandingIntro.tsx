import styles from './PublicLandingIntro.module.css'

export default function PublicLandingIntro() {
  return (
    <section className={styles.hero} aria-labelledby="public-landing-title">
      <div className={styles.copy}>
        <p className="eyebrow">Plan de jurisdicciones eclesiales</p>
        <h1 id="public-landing-title">Comprende cómo se organiza la Iglesia católica desde la Santa Sede</h1>
        <p className={styles.lead}>
          Explora provincias eclesiásticas, arquidiócesis, diócesis, ordinariatos y otras jurisdicciones
          mediante un árbol histórico, documentado y explicado en lenguaje accesible.
        </p>
        <div className={styles.actions}>
          <a className="button button-primary" href="#plan-jurisdicciones">Explorar el plan</a>
          <a className="button button-secondary" href="#explorador">Buscar por país</a>
        </div>
      </div>

      <aside className={styles.scope} aria-label="Alcance actual de la plataforma">
        <strong>Un único centro</strong>
        <p>La fase actual de SINEP se concentra exclusivamente en jurisdicciones eclesiales y su evolución histórica.</p>
        <ul>
          <li>Santa Sede y dependencias canónicas</li>
          <li>Provincias y jurisdicciones eclesiales</li>
          <li>Historia, conceptos y fuentes documentales</li>
        </ul>
      </aside>
    </section>
  )
}
