# Sprint 5 — Eventos y evolución institucional

> Estado: completado
> Inicio: 2026-07-15
> Cierre: 2026-07-16
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
11. [x] S5-11 — Ejecutar `pnpm check`, pruebas funcionales y verificación del entorno desplegado.

## Resultado técnico

- `canonical_events` queda declarada como fuente oficial del hecho histórico.
- El catálogo canónico conserva claves históricas y añade clasificación, destino, estrategia de aplicación y revisión manual.
- Los 23 eventos heredados fueron migrados de forma idempotente y quedaron pendientes de revisión.
- Verificación, aprobación y aplicación permanecen separadas.
- El plan de impacto es determinista, de solo lectura y detecta dependencias inexistentes, ciclos y conflictos.
- La aplicación serializa por bloqueo de fila, conserva orden determinista y es idempotente.
- La cronología administrativa y pública se proyectan desde el modelo canónico.
- Los errores registrales se corrigen sobre el mismo evento mediante `canonical_event_revisions`, con antes, después, motivo, fuente, actor y fecha.
- Los cambios institucionales reales continúan registrándose como eventos nuevos.
- `public_entity_evolution_events` conserva sus 27 columnas, pero deriva del modelo canónico y publica solo eventos aplicados.
- Las pruebas funcionales reversibles confirmaron rechazo sin permiso, rechazo fuera de alcance y autorización dentro de alcance.
- La ejecución final de CI quedó en verde: documentación, terminología, auditorías, TypeScript, pruebas y build aprobados.

## Reglas consolidadas

- No se introduce un segundo motor de eventos.
- Un borrador no modifica el estado vigente.
- Verificación, aprobación y aplicación son estados distintos.
- Todo plan de impacto es de solo lectura hasta la aplicación confirmada.
- La aplicación debe ser transaccional, idempotente, acotada por permisos y auditada.
- Un cambio institucional real siempre se registra como un evento nuevo.
- Un error de registro se corrige sobre el mismo evento mediante una revisión inmutable y auditada.
- Las vistas públicas solo exponen el estado histórico corregido y publicable.

## Criterios de cierre

- [x] Todo cambio estructural importante se origina en un evento canónico.
- [x] El estado vigente se puede reconstruir desde la historia aplicada.
- [x] Los usuarios ven el impacto y los conflictos antes de aprobar o aplicar.
- [x] La revisión, aprobación y aplicación conservan separación de responsabilidades.
- [x] Cada corrección conserva antes, después, motivo, fuente, actor y fecha.
- [x] Cada operación crítica conserva permiso, alcance, transacción, auditoría y prueba.
- [x] CI valida documentación, arquitectura, TypeScript, pruebas y build.

## Dependencias operativas no bloqueantes

La matriz E2E autenticada y las comprobaciones protegidas sobre un entorno público continuarán cuando exista una URL autorizada y cuentas diferenciadas. No bloquean el cierre técnico de este sprint.
