# Auditoría inicial del modelo de eventos — Sprint 5

> Estado: en progreso
> Fecha: 2026-07-15
> Sprint: [Sprint 5 — Eventos y evolución institucional](./sprint-5.md)
> Responsable: dominios de eventos, estructuras y auditoría

## Propósito

Inventariar los contratos existentes antes de modificar el motor de eventos y declarar qué componentes forman la fuente canónica de la evolución institucional.

## Hallazgo principal

El repositorio ya dispone de un flujo canónico considerable. No corresponde crear un motor nuevo. La consolidación debe realizarse alrededor de:

- `canonical_events` como registro del hecho institucional;
- `canonical_event_types` como catálogo de tipos;
- participantes de evento con destino explícito `entity` u `organization_unit`;
- acciones y planes de aplicación como proyección previa al cambio de estado;
- contratos separados de borrador, revisión, aprobación y aplicación;
- registro público mediante `get_event_registry_stream`.

## Contratos de aplicación identificados

### Borrador

`event-draft-admin-service.ts` crea borradores mediante `admin_create_event_draft` y conserva:

- modo de carga;
- tipo de evento;
- fecha del evento;
- fecha efectiva;
- entidad participante y rol;
- fuente y URL;
- estado de evidencia;
- notas.

Los modos actuales son `carga_historica`, `evento_nuevo` y `foto_inicial`. El borrador no aplica cambios estructurales.

### Revisión

`event-workflow-admin-service.ts` carga eventos canónicos desde `get_event_registry_stream`, consulta `get_event_review` y ejecuta `admin_review_event` con acciones separadas:

- `approve`;
- `cancel`;
- `return_to_draft`.

El contrato de revisión comprueba título, tipo, fecha o foto inicial, participantes, fuente, plan de acciones, bloqueos y estado pendiente.

### Plan de impacto

`event-application-admin-service.ts` usa:

- `get_event_application_plan`;
- `admin_generate_event_action_plan`;
- `get_event_action_editor_options`;
- `admin_configure_event_action`;
- `admin_update_event_action`;
- `get_event_relationship_conflict_preview`;
- `get_event_application_contract`.

El plan distingue acciones planificadas, listas, aplicadas, omitidas o fallidas; identifica acciones que cambian estado, requieren revisión manual o presentan conflictos relacionales.

### Aplicación

La aplicación de eventos sobre unidades organizativas ya se expone mediante `admin_apply_organization_unit_event`. Debe auditarse la paridad para eventos sobre entidades y relaciones territoriales antes de declarar el contrato completamente unificado.

## Decisión canónica preliminar

1. `canonical_events` será el registro canónico del hecho.
2. Los modelos estructurales no deben mantener un segundo registro histórico competidor.
3. Los planes y acciones son derivados operativos del evento; no sustituyen al hecho histórico.
4. Revisión, aprobación y aplicación permanecerán separadas.
5. Solo un evento aprobado y con contrato aplicable puede modificar el estado vigente.
6. Las correcciones se representarán mediante eventos compensatorios.

## Brechas que S5-01 debe cerrar

- Inventariar todas las tablas y RPC que todavía usan nombres `structure_events`, `structural_*` o modelos heredados.
- Confirmar qué flujos aplican cambios a entidades, relaciones, nodos y unidades organizativas.
- Detectar rutas duplicadas entre `/admin/eventos` y `/admin/estructura/eventos` y clasificar redirecciones de compatibilidad.
- Verificar que todas las aplicaciones pasen por fachadas públicas con implementación privada, permisos y auditoría.
- Confirmar que las vistas públicas solo expongan eventos aprobados y publicables.
- Construir una matriz evento → acción → destino → RPC → auditoría → prueba.

## Riesgos detectados

- `evidence_status` mantiene un catálogo histórico distinto del nuevo contrato común `verification_status`; debe definirse una adaptación explícita y no mezclar ambos campos silenciosamente.
- La vista previa de conflictos relacionales se omite para `organization_unit`; debe confirmarse que el contrato organizativo tiene validaciones equivalentes en base de datos.
- La aplicación visible en el servicio está especializada para unidades organizativas; falta demostrar paridad con entidades y relaciones territoriales.
- Los tipos `applies_to` deben limitarse a destinos canónicos y no reintroducir modelos eliminados.

## Criterio de cierre de S5-01

- Existe una matriz completa de consumidores y escritores del modelo de eventos.
- Cada tabla y RPC queda clasificada como canónica, compatibilidad, derivada o eliminable.
- No queda ambigüedad sobre la fuente oficial del hecho histórico.
- Las brechas se convierten en tareas S5-02 a S5-10 con criterios verificables.
