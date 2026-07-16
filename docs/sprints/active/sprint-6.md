# Sprint 6 — Importaciones y calidad de datos

> Estado: activo
> Inicio: 2026-07-16
> Rama operativa: `main`
> Propietario: dominios de importaciones, revisión y calidad de datos

## Objetivo

Convertir las cargas específicas existentes en un sistema reutilizable, seguro y corregible para personas, estructuras, asignaciones y eventos, sin permitir que un archivo modifique datos definitivos directamente.

## Cola de ejecución

1. [x] S6-01 — Auditar el flujo actual de importaciones, plantillas, lotes, filas, incidencias, referencias y aplicación.
2. [x] S6-02 — Declarar un contrato único para archivos, plantillas versionadas y dominios soportados.
3. [x] S6-03 — Completar lectura robusta de CSV y definir la estrategia XLSX sin duplicar validadores.
4. [x] S6-04 — Consolidar staging común, normalización y validación por fila.
5. [x] S6-05 — Unificar detección de duplicados, coincidencias exactas y referencias ambiguas.
6. [ ] S6-06 — Completar el editor de filas fallidas sin exigir recargar el archivo completo.
7. [ ] S6-07 — Generar una vista previa determinista con operaciones `create`, `update`, `noop`, `blocked` y `unresolved`.
8. [ ] S6-08 — Aplicar lotes mediante RPC transaccionales, idempotentes y auditadas.
9. [ ] S6-09 — Implementar reversión lógica y trazabilidad de cambios aplicados por lote.
10. [ ] S6-10 — Completar reportes descargables, errores y resultados por fila.
11. [ ] S6-11 — Integrar todos los tipos pendientes en la cola de revisión y calidad de datos.
12. [ ] S6-12 — Ejecutar pruebas funcionales, `pnpm check` y cierre del sprint.

## Alcance inicial

Antes de modificar el modelo se debe inventariar:

- rutas `/admin/importar`, `/admin/importar/lotes` y `/admin/importar/[batchId]`;
- servicios, plantillas y parsers CSV actuales;
- tablas de lotes, filas, incidencias y cambios aplicados;
- RPC de validación, corrección y aplicación;
- catálogos de referencia para personas, entidades, estructuras, cargos y eventos;
- flujos de candidatos de persona, referencias ambiguas y campos faltantes;
- reportes finales y contratos de auditoría;
- dependencias necesarias para XLSX y su impacto en seguridad, tamaño y mantenimiento.

## Estado técnico

S6-01 queda documentado en la [auditoría del flujo actual de importaciones](./sprint-6-import-audit.md). La infraestructura existente ya cubre cuatro dominios, plantillas CSV, hash SHA-256, límites de tamaño y filas, persistencia de lotes y filas, incidencias, corrección individual, revalidación, revisión, aplicación manual e idempotencia. La API de preparación exige `imports.prepare` y delega en `admin_prepare_import_batch`; ningún archivo escribe directamente en tablas canónicas.

S6-02 queda protegido por `import-batch-shared-contract.test.mjs`. `import-batch-contract.ts` declara los cuatro dominios, columnas, columnas obligatorias, notas, formatos aceptados, versión de plantilla y límites de tamaño, filas y vista previa. La interfaz y la API de preparación consumen ese mismo contrato; el servidor valida además que la versión de plantilla recibida sea la vigente.

S6-03 queda documentado en la [estrategia CSV y XLSX](./sprint-6-csv-xlsx-strategy.md) y protegido por `import-csv-robustness-contract.test.mjs`. El parser admite UTF-8 con o sin BOM, coma, punto y coma o tabulación, campos citados, comillas escapadas y saltos de línea internos. Rechaza delimitadores ambiguos, caracteres nulos, comillas sin cerrar, encabezados inválidos, filas desalineadas y límites de columnas o celdas. XLSX y XLS permanecen reconocidos como formatos de origen, pero no son procesables: deben exportarse a CSV UTF-8 y la API rechaza su preparación directa.

S6-04 queda protegido por `import-staging-contract.test.mjs`. La migración `20260716050000_consolidate_import_staging_contract.sql` crea un contrato SQL común por dominio con campos requeridos y relaciones, una normalización determinista por dominio y una prioridad única de estados por incidencias abiertas. La preparación inicial y la corrección individual reutilizan el mismo normalizador; país, claves de catálogo, visibilidad y booleanos quedan canonicalizados antes de calcular el hash y revalidar. La función interna de preparación acepta únicamente CSV como defensa adicional.

S6-05 queda protegido por `import-match-classification-contract.test.mjs`. La migración `20260716053000_unify_import_match_classification.sql` declara un resultado uniforme `not_found`, `exact` o `ambiguous`, conserva candidatos ordenados y solo expone `selected_id` cuando existe una coincidencia única. Personas, estructuras, asignaciones y eventos reutilizan el clasificador para promover coincidencias exactas a `noop`; las coincidencias múltiples eliminan cualquier destino automático y generan una incidencia de revisión manual.

Los vacíos principales restantes son: representación uniforme de `blocked` y `unresolved`, reversión lógica y validación integral de alcance.

## Reglas del sprint

- Ningún archivo escribe directamente en tablas canónicas.
- Cada lote conserva actor, fecha, origen, hash, plantilla, dominio, estado y estadísticas.
- Cada fila conserva datos originales, datos normalizados, resultado, incidencias y operación prevista.
- Las coincidencias ambiguas bloquean; nunca se selecciona una entidad o persona arbitrariamente.
- Las filas corregidas se revalidan sin volver a cargar el archivo completo.
- La aplicación es transaccional e idempotente por lote y fila.
- Las operaciones definitivas reutilizan los motores canónicos de personas, estructuras, asignaciones y eventos.
- Toda aplicación y reversión lógica queda auditada.
- XLSX no se incorpora hasta confirmar una dependencia mantenida, segura y compatible con el entorno.

## Criterios de cierre

- Ningún archivo modifica datos definitivos directamente.
- Todo lote tiene estado, usuario, fecha, origen, hash y reporte.
- Las filas fallidas se corrigen y revalidan individualmente.
- Las coincidencias exactas producen `noop` auditables y las ambiguas permanecen bloqueadas.
- La vista previa coincide con las operaciones aplicadas.
- La aplicación puede reintentarse sin duplicar registros.
- La cola de revisión permite resolver todos los tipos que muestra.
- CI valida contratos, TypeScript, pruebas y build.

## Riesgos iniciales

- Las importaciones ya contienen funcionalidad avanzada distribuida entre migraciones, servicios y pruebas; duplicarla produciría un segundo motor.
- La lectura XLSX puede aumentar superficie de dependencias y consumo de memoria.
- Una reversión física de datos aplicados puede destruir historia; la estrategia debe ser lógica y auditada.
- Los catálogos y permisos deben respetar el alcance del usuario que cargó y del usuario que aplica el lote.
