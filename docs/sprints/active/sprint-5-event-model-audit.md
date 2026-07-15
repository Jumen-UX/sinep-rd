# Auditoría inicial del modelo de eventos — Sprint 5

> Estado: completado
> Fecha: 2026-07-15
> Sprint: [Sprint 5 — Eventos y evolución institucional](./sprint-5.md)
> Responsable: dominios de eventos, estructuras y auditoría

## Propósito

Inventariar los contratos existentes antes de modificar el motor de eventos y declarar qué componentes forman la fuente canónica de la evolución institucional.

## Decisión canónica

El repositorio ya dispone de un flujo canónico considerable. No corresponde crear otro motor.

La fuente oficial del hecho histórico es `canonical_events`, tipificada por `canonical_event_types`. Los participantes identifican el objeto afectado —entidad u unidad organizativa— y los planes y acciones representan una proyección operativa derivada. Las tablas estructurales, relaciones y unidades organizativas reflejan el estado vigente después de una aplicación; no deben competir como otro registro histórico.

Reglas resultantes:

1. `canonical_events` es el registro canónico del hecho.
2. `canonical_event_types` es el catálogo canónico del tipo institucional.
3. Participantes, planes, acciones y contratos de aplicación son derivados del evento.
4. Revisión, aprobación y aplicación permanecen separadas.
5. Solo un evento aprobado, verificable y con contrato aplicable puede cambiar el estado vigente.
6. Las correcciones se representan mediante eventos compensatorios.
7. `/admin/eventos` es la ruta administrativa canónica.
8. `/admin/estructura/eventos` es una superficie de compatibilidad temporal y debe redirigir o delegar sin mantener lógica propia.
9. El registro público se consume mediante `get_event_registry_stream` y solo debe exponer eventos publicables.

## Matriz de contratos

| Componente | Responsabilidad | Clasificación | Escritura de estado vigente | Contrato principal |
|---|---|---|---:|---|
| `canonical_events` | Hecho histórico, fechas, estado, evidencia y ciclo de vida | Canónico | No directamente | Borrador → revisión → aprobación → aplicación |
| `canonical_event_types` | Catálogo institucional y destino `applies_to` | Canónico | No | Tipificación del evento |
| Participantes de evento | Entidad o unidad organizativa afectada, rol y estados antes/después | Derivado persistente | No | Destino explícito `entity` / `organization_unit` |
| Planes de aplicación | Resumen determinista de impacto | Derivado | No | `get_event_application_plan` |
| Acciones de evento | Operaciones concretas planificadas, listas, aplicadas u omitidas | Derivado operativo | Solo mediante aplicador | `admin_generate_event_action_plan`, `admin_configure_event_action`, `admin_update_event_action` |
| Contrato de aplicación | Permisos, bloqueos, conflictos y aplicabilidad | Derivado de solo lectura | No | `get_event_application_contract` |
| Relaciones, nodos, entidades y unidades organizativas | Estado institucional vigente | Proyección aplicada | Sí, por RPC transaccional | Aplicadores canónicos |
| `get_event_registry_stream` | Lectura administrativa y pública del registro | Proyección de lectura | No | Registro cronológico |
| `/admin/eventos/**` | UI administrativa vigente | Canónico | Mediante servicios/RPC | Feature `events` |
| `/admin/estructura/eventos/**` | Entrada histórica anterior | Compatibilidad | No debe escribir directamente | Delegación o redirección |
| Nombres `structural_*` históricos | Compatibilidad de migraciones o contratos antiguos | Compatibilidad revisable | No como fuente nueva | Migración progresiva |

## Flujo de borrador

`event-draft-admin-service.ts` crea borradores mediante `admin_create_event_draft` y conserva:

- modo de carga;
- tipo de evento;
- fecha del evento;
- fecha efectiva;
- título y descripción;
- entidad participante y rol;
- fuente y URL;
- estado de evidencia;
- notas.

Los modos actuales son `carga_historica`, `evento_nuevo` y `foto_inicial`. El borrador no aplica cambios estructurales.

## Flujo de revisión

`event-workflow-admin-service.ts`:

- carga eventos canónicos desde `get_event_registry_stream`;
- consulta `get_event_review`;
- ejecuta `admin_review_event` con `approve`, `cancel` o `return_to_draft`;
- verifica título, tipo, fecha o foto inicial, participantes, fuente, plan, bloqueos y estado pendiente.

La aprobación confirma el evento, pero no debe confundirse con la aplicación del cambio.

## Plan e impacto

`event-application-admin-service.ts` usa:

- `get_event_application_plan`;
- `admin_generate_event_action_plan`;
- `get_event_action_editor_options`;
- `admin_configure_event_action`;
- `admin_update_event_action`;
- `get_event_relationship_conflict_preview`;
- `get_event_application_contract`.

El plan distingue acciones `planned`, `ready`, `applied`, `skipped` y `failed`; identifica cambios de estado, revisión manual y conflictos. Es una proyección de solo lectura hasta que un aplicador confirmado ejecuta la transacción.

## Aplicación y paridad

La aplicación de eventos sobre unidades organizativas se expone mediante `admin_apply_organization_unit_event`. El flujo de entidades y relaciones territoriales está distribuido entre contratos estructurales previos y debe consolidarse sin crear un segundo motor.

S5-05 a S5-07 deberán demostrar para cada acción:

- destino canónico;
- RPC público;
- implementación privada cuando se requieran privilegios;
- permiso y alcance;
- bloqueo de concurrencia;
- idempotencia;
- auditoría;
- prueba contractual y funcional.

## Rutas administrativas

Se confirmó que:

- `/admin/eventos` y `/admin/estructura/eventos` delegan actualmente al mismo `EventRegistryPage`;
- los detalles antiguos bajo `/admin/estructura/eventos/[eventId]` delegan al mismo feature;
- `/admin/estructura/eventos/verificacion` ya redirige a `/admin/eventos/verificacion`.

Decisión: mantener temporalmente las rutas antiguas como compatibilidad mediante redirección explícita y eliminar duplicaciones de renderizado en S5-02/S5-03, preservando enlaces existentes.

## Matriz evento → acción → destino → control

| Familia de evento | Acciones esperadas | Destino vigente | Aplicación requerida | Prueba mínima |
|---|---|---|---|---|
| Creación / erección | crear entidad, nodo o unidad; establecer dependencia | Entidad / nodo / unidad | Transacción idempotente | creación sin duplicación |
| División / desmembramiento | crear destino, mover relaciones o territorio, cerrar dependencia anterior | Entidades y relaciones | Plan con conflictos y fechas efectivas | conservación del origen e historia |
| Fusión | cerrar entidades/unidades anteriores, crear o seleccionar sucesora, transferir relaciones | Entidades / unidades | Aplicación atómica | sin doble vigencia |
| Traslado | cambiar sede o dependencia sin reescribir el hecho originario | Entidad / relación | Evento aplicado con fecha efectiva | historial anterior preservado |
| Supresión | cerrar vigencia y relaciones activas sin borrar filas históricas | Entidad / unidad / relaciones | Evento aprobado y auditado | estado inactivo reconstruible |
| Cambio de dependencia | cerrar relación vigente y crear sucesora | Relaciones territoriales u organizativas | Validación de ciclos y alcance | predecesor/sucesor explícitos |
| Corrección | compensar evento aplicado mediante un evento nuevo | Evento y estado derivado | Nunca `DELETE` destructivo | trazabilidad bidireccional |

## Brechas asignadas al resto del sprint

- **S5-02:** consolidar el catálogo institucional y limitar `applies_to` a destinos canónicos.
- **S5-03:** normalizar eventos existentes y contratos `structural_*` sin aprobar datos dudosos.
- **S5-04:** adaptar `evidence_status` al contrato común de fuente y `verification_status`.
- **S5-05:** completar planes deterministas y paridad de conflictos para entidades y unidades.
- **S5-06:** asegurar separación entre revisión, aprobación y aplicación.
- **S5-07:** consolidar aplicadores transaccionales, idempotentes, acotados y auditados.
- **S5-08:** proyectar línea temporal y reconstrucción del estado vigente.
- **S5-09:** introducir relaciones explícitas de compensación.
- **S5-10:** validar permisos, alcance, concurrencia y reversibilidad.

## Riesgos vigentes

- `evidence_status` usa un catálogo histórico distinto del contrato común `verification_status`; requiere adaptación explícita.
- La vista previa relacional se omite en el servicio para `organization_unit`; la equivalencia debe demostrarse en base de datos o implementarse.
- La aplicación visible en el servicio está especializada para unidades organizativas; falta unificar el despacho de entidades y relaciones.
- Las rutas heredadas todavía renderizan directamente el feature en algunos casos y deben convertirse en redirecciones de compatibilidad.
- Los nombres estructurales heredados pueden seguir siendo necesarios en migraciones históricas, pero no deben recibir nuevas escrituras.

## Criterio de cierre alcanzado

- Existe una matriz de consumidores y escritores del modelo de eventos.
- Cada grupo se clasifica como canónico, derivado, compatibilidad o proyección aplicada.
- `canonical_events` queda declarado como única fuente oficial del hecho histórico.
- Las brechas quedan asignadas a tareas S5-02 a S5-10 con criterios verificables.
