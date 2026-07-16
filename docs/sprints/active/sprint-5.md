# Sprint 5 — Eventos y evolución institucional

> Estado: activo
> Inicio: 2026-07-15
> Rama operativa: `main`
> Propietario: dominios de eventos, estructuras y auditoría

## Objetivo

Hacer efectiva la regla de no editar silenciosamente la historia: todo cambio estructural importante debe originarse en un evento verificable, revisable y aplicable de forma transaccional; los errores de registro se corrigen sobre el mismo evento mediante revisiones auditadas.

## Cola de ejecución

1. [x] S5-01 — Auditar los modelos y flujos de eventos existentes y declarar una única fuente canónica.
2. [x] S5-02 — Consolidar el catálogo de eventos institucionales: creación, división, fusión, desmembramiento, traslado, supresión y cambio de dependencia.
3. [x] S5-03 — Migrar y normalizar los eventos de evolución existentes sin aprobar ni aplicar datos dudosos.
4. [x] S5-04 — Unificar borrador, fuente documental, fecha efectiva, alcance y estado de verificación.
5. [x] S5-05 — Generar un plan de impacto determinista y de solo lectura antes de aprobar.
6. [x] S5-06 — Implementar revisión y aprobación separadas de la aplicación.
7. [x] S5-07 — Aplicar eventos aprobados mediante transacciones idempotentes y auditadas.
8. [x] S5-08 — Proyectar la línea temporal institucional y reconstruir el estado vigente desde la historia.
9. [x] S5-09 — Implementar correcciones versionadas del mismo evento, sin crear hechos históricos artificiales.
10. [x] S5-10 — Validar permisos, alcance, conflictos, concurrencia, correcciones y compatibilidad heredada.
11. [ ] S5-11 — Ejecutar `pnpm check`, pruebas funcionales y verificación del entorno desplegado.

## Alcance inicial

El sprint parte de la infraestructura existente de eventos canónicos y estructurales. Antes de crear nuevas tablas o rutas se debe inventariar:

- `canonical_events` y sus lectores administrativos y públicos;
- eventos estructurales y planes de aplicación;
- acciones sobre entidades, relaciones, nodos y unidades organizativas;
- flujos de borrador, verificación, revisión, aprobación y aplicación;
- funciones privilegiadas, fachadas públicas, permisos y auditoría;
- modelos heredados o rutas duplicadas que todavía compitan por el mismo propósito.

## Estado técnico

S5-01 queda documentado en la [auditoría del modelo canónico de eventos](./sprint-5-event-model-audit.md) y protegido por `canonical-event-model-audit.test.mjs`. La fuente oficial del hecho histórico es `canonical_events`; `canonical_event_types` tipifica el hecho; participantes, planes, acciones y contratos son derivados; y las entidades, relaciones, nodos y unidades organizativas representan el estado aplicado. `/admin/eventos` es la ruta canónica y `/admin/estructura/eventos` queda clasificada como compatibilidad temporal.

S5-02 queda protegido por `canonical-event-catalog-classification.test.mjs`. La migración `20260715210000_classify_canonical_event_catalog.sql` conserva las claves históricas y añade clasificación institucional explícita: familia, destino canónico, estrategia de aplicación, revisión manual y capacidad de corrección.

S5-03 queda protegido por `legacy-entity-evolution-migration.test.mjs`. La migración `20260715214500_migrate_legacy_entity_evolution_events.sql` trasladó 23 registros de `entity_evolution_events` a `canonical_events` de forma idempotente y dejó todos los registros en `pending_review`, sin aprobación ni aplicación automática.

S5-04 queda protegido por `event-verification-contract.test.mjs`. La migración `20260715223000_unify_canonical_event_verification.sql` conserva `evidence_status` y añade `verification_status` y `source_checked_at` conforme al contrato común. Los 24 eventos existentes permanecen en `pending_review`.

S5-05 queda protegido por `event-impact-plan-contract.test.mjs`. El constructor `buildDeterministicImpactPlan` ordena acciones de forma estable, interpreta dependencias explícitas, detecta referencias inexistentes y ciclos, integra conflictos y proyecta los elementos afectados antes de aprobar.

S5-06 queda protegido por `event-approval-separation-contract.test.mjs`. La migración `20260715234500_separate_event_approval_from_application.sql` introduce `admin_approve_event`; aprobar modifica únicamente metadatos del flujo y nunca aplica estado institucional.

S5-07 queda protegido por `idempotent-event-application-contract.test.mjs` y `verify_idempotent_event_application.sql`. La aplicación remota serializa por bloqueo de fila, valida dependencias, conserva orden determinista y devuelve `idempotent_replay=true` en reintentos sin repetir mutaciones.

S5-08 queda protegido por `canonical-institutional-timeline-contract.test.mjs`. Las vistas canónicas separan la cronología administrativa de la pública y `get_institutional_state_reconstruction` compara el último `after_state` aplicado con el registro vigente sin modificar datos.

S5-09 queda protegido por `canonical-event-revision-contract.test.mjs`. La migración `20260716032000_replace_compensation_with_event_revisions.sql` elimina el contrato descartado de compensación y crea `canonical_event_revisions`. `admin_correct_canonical_event` bloquea el evento, acepta únicamente campos autorizados, exige motivo, conserva `before_state`, `after_state`, campos modificados, fuente, usuario y fecha, y registra auditoría `events.corrected`. La cronología pública muestra el evento corregido; el historial anterior queda disponible solo en administración y auditoría. Los cambios institucionales reales continúan registrándose como eventos nuevos. Actualmente existen cero revisiones reales.

S5-10 queda protegido por `event-security-consistency-matrix.test.mjs`, `event-correction-permission-scope-contract.test.mjs`, `event-correction-ui-contract.test.mjs` y `legacy-public-evolution-compatibility.test.mjs`. La creación de revisiones y su historial requieren `events.approve`, aplican alcance territorial y serializan las modificaciones por bloqueo de fila. La prueba funcional reversible confirmó tres escenarios: rechazo sin permiso, rechazo fuera de jurisdicción y autorización dentro de alcance; el `ROLLBACK` dejó cero revisiones y cero títulos temporales. La vista `public_entity_evolution_events` conserva sus 27 columnas, pero ahora deriva exclusivamente del modelo canónico, publica solo eventos aplicados y ya no depende de `entity_evolution_events`.

## Reglas del sprint

- No se introduce un segundo motor de eventos.
- Un borrador no modifica el estado vigente.
- Verificación, aprobación y aplicación son estados distintos.
- Todo plan de impacto es de solo lectura hasta la aplicación confirmada.
- La aplicación debe ser transaccional, idempotente, acotada por permisos y auditada.
- Un cambio institucional real siempre se registra como un evento nuevo.
- Un error de registro se corrige sobre el mismo evento mediante una revisión inmutable y auditada.
- Las fuentes y fechas efectivas se validan mediante el contrato común de verificación.
- Las vistas públicas solo exponen el estado histórico corregido y publicable.

## Criterios de cierre

- Todo cambio estructural importante se origina en un evento canónico.
- El estado vigente se puede reconstruir desde la historia aplicada.
- Los usuarios ven el impacto y los conflictos antes de aprobar o aplicar.
- La revisión, aprobación y aplicación conservan separación de responsabilidades.
- Cada corrección conserva antes, después, motivo, fuente, actor y fecha.
- Cada operación crítica conserva permiso, alcance, transacción, auditoría y prueba.

## Dependencias operativas heredadas

La matriz E2E autenticada y las comprobaciones protegidas de producción continúan como dependencia operativa no bloqueante. Se ejecutarán cuando exista una URL autorizada y cuentas diferenciadas.
