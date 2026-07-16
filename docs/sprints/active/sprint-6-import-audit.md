# Auditoría del flujo actual de importaciones

## Alcance revisado

Se revisaron la entrada administrativa `/admin/importar`, la página principal de carga, el servicio cliente de lotes, el parser CSV y la ruta API de preparación.

## Arquitectura vigente

El flujo ya está separado por capas:

1. La ruta `/admin/importar` delega en `AdminBatchImportPage`.
2. La página cliente selecciona dominio, genera plantilla, valida extensión y tamaño, calcula SHA-256 y construye la vista previa.
3. `batch-import-admin-service.ts` concentra preparación, consulta, revalidación, revisión, aplicación y corrección de filas.
4. La API `/api/admin/importaciones/preparar` valida permiso `imports.prepare`, metadatos, hash, encabezados, tamaño y filas antes de invocar `admin_prepare_import_batch`.
5. La persistencia definitiva se delega a RPC canónicas y no al archivo ni al componente cliente.

## Capacidades implementadas

### Dominios

- `personas`
- `parroquias`
- `asignaciones`
- `eventos`

### Archivo y seguridad

- Plantillas CSV por dominio.
- UTF-8 con BOM en las plantillas.
- Hash SHA-256 del archivo.
- Límite de 10 MB.
- Límite inicial de 5,000 filas.
- Rechazo de encabezados vacíos o duplicados.
- Validación de columnas obligatorias y detección de columnas extra.
- Manejo de campos CSV entre comillas y comillas escapadas.
- Permiso específico `imports.prepare` en servidor.

### Persistencia y ciclo de vida

El contrato cliente ya contempla:

- estados `prepared`, `validating`, `needs_review`, `validated`, `applying`, `applied`, `failed` y `cancelled`;
- revisión `pending`, `approved` y `rejected`;
- estadísticas de filas válidas, advertencias, errores, duplicados y referencias no resueltas;
- detalle por fila con `raw_data`, `normalized_data`, `resolved_relations`, hash y operación prevista;
- operaciones `create`, `update` y `noop`;
- corrección individual de filas;
- revalidación del lote;
- aprobación o rechazo;
- aplicación manual;
- reintento idempotente mediante `idempotent_replay`;
- resumen final y auditoría.

## Capacidades parciales

### XLSX y XLS

La interfaz acepta extensiones `.xlsx` y `.xls`, y la API reconoce esas extensiones, pero la lectura segura solo está implementada para CSV. Los archivos de Excel se rechazan operativamente con la instrucción de exportarlos como CSV UTF-8.

Esto evita una falsa promesa funcional, pero el contrato visual debe distinguir claramente entre formatos reconocidos y formatos realmente procesables.

### Vista previa

La vista previa visual se limita a 25 filas, mientras el lote completo puede contener hasta 5,000. Esta separación es correcta, pero debe quedar protegida por pruebas para asegurar que la persistencia usa todas las filas y no solo la muestra visible.

### Contrato de operaciones

El tipo de fila expone `create`, `update` y `noop`, mientras el Sprint 6 requiere representar también `blocked` y `unresolved` de manera explícita como operación proyectada. Actualmente esos estados existen en `status` e incidencias, no necesariamente en `target_operation`.

## Riesgos detectados

1. La definición de columnas y notas de cada dominio está embebida en `AdminBatchImportPage.tsx`; esto puede divergir de la validación de servidor y de las plantillas futuras.
2. La lista de extensiones permitidas incluye formatos que todavía no pueden procesarse.
3. El parser CSV es propio; debe ampliarse con pruebas de separadores, saltos de línea embebidos, espacios significativos y archivos grandes antes de declararlo completo.
4. Los límites de 10 MB y 5,000 filas están duplicados entre cliente y servidor. El servidor es la autoridad, pero conviene declarar un contrato compartido para evitar divergencias.
5. El alcance territorial es opcional en el contrato cliente; debe verificarse por dominio y volver a validarse al aplicar.
6. La reversión lógica todavía no aparece en el servicio cliente revisado.

## Decisión arquitectónica

No se construirá un segundo motor de importaciones. El trabajo de Sprint 6 debe consolidar el contrato existente y completar sus vacíos:

- mover definiciones de dominio y plantilla a un catálogo compartido;
- mantener el servidor como autoridad de límites y permisos;
- representar de forma uniforme operaciones, bloqueos e incidencias;
- conservar corrección y revalidación por fila;
- reutilizar RPC canónicas por dominio;
- añadir reversión lógica y reportes sin eliminar trazabilidad.

## Estado de S6-01

Completado. La infraestructura base es avanzada y reutilizable. Los principales faltantes son consolidación del contrato compartido, estrategia XLSX, representación uniforme de operaciones bloqueadas, reversión lógica y validación integral del alcance.