# Sprint 5 — Eventos y evolución institucional

> Estado: activo
> Inicio: 2026-07-15
> Rama operativa: `main`
> Propietario: dominios de eventos, estructuras y auditoría

## Objetivo

Hacer efectiva la regla de no editar silenciosamente la historia: todo cambio estructural importante debe originarse en un evento verificable, revisable, aplicable de forma transaccional y compensable sin borrar hechos históricos.

## Cola de ejecución

1. [ ] S5-01 — Auditar los modelos y flujos de eventos existentes y declarar una única fuente canónica.
2. [ ] S5-02 — Consolidar el catálogo de eventos institucionales: creación, división, fusión, desmembramiento, traslado, supresión y cambio de dependencia.
3. [ ] S5-03 — Migrar y normalizar los eventos de evolución existentes sin aprobar ni aplicar datos dudosos.
4. [ ] S5-04 — Unificar borrador, fuente documental, fecha efectiva, alcance y estado de verificación.
5. [ ] S5-05 — Generar un plan de impacto determinista y de solo lectura antes de aprobar.
6. [ ] S5-06 — Implementar revisión y aprobación separadas de la aplicación.
7. [ ] S5-07 — Aplicar eventos aprobados mediante transacciones idempotentes y auditadas.
8. [ ] S5-08 — Proyectar la línea temporal institucional y reconstruir el estado vigente desde la historia.
9. [ ] S5-09 — Implementar correcciones mediante eventos compensatorios, sin borrado destructivo.
10. [ ] S5-10 — Validar permisos, alcance, conflictos, concurrencia y reversibilidad.
11. [ ] S5-11 — Ejecutar `pnpm check`, pruebas funcionales y verificación del entorno desplegado.

## Alcance inicial

El sprint parte de la infraestructura existente de eventos canónicos y estructurales. Antes de crear nuevas tablas o rutas se debe inventariar:

- `canonical_events` y sus lectores administrativos y públicos;
- eventos estructurales y planes de aplicación;
- acciones sobre entidades, relaciones, nodos y unidades organizativas;
- flujos de borrador, verificación, revisión, aprobación y aplicación;
- funciones privilegiadas, fachadas públicas, permisos y auditoría;
- modelos heredados o rutas duplicadas que todavía compitan por el mismo propósito.

## Reglas del sprint

- No se introduce un segundo motor de eventos.
- Un borrador no modifica el estado vigente.
- Verificación, aprobación y aplicación son estados distintos.
- Todo plan de impacto es de solo lectura hasta la aplicación confirmada.
- La aplicación debe ser transaccional, idempotente, acotada por permisos y auditada.
- Un hecho histórico aplicado no se elimina para corregirlo; se crea un evento compensatorio.
- Las fuentes y fechas efectivas se validan mediante el contrato común de verificación.
- Las vistas públicas solo exponen eventos aprobados y publicables.

## Criterios de cierre

- Todo cambio estructural importante se origina en un evento canónico.
- El estado vigente se puede reconstruir desde la historia aplicada.
- Los usuarios ven el impacto y los conflictos antes de aprobar o aplicar.
- La revisión, aprobación y aplicación conservan separación de responsabilidades.
- Las correcciones no eliminan hechos históricos.
- Cada operación crítica conserva fuente, permiso, alcance, transacción, auditoría y prueba.

## Dependencias operativas heredadas

La matriz E2E autenticada y las comprobaciones protegidas de producción continúan como dependencia operativa no bloqueante. Se ejecutarán cuando exista una URL autorizada y cuentas diferenciadas.