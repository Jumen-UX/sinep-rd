# Sprint 2 · Contrato de ciclo de vida organizativo

Fecha: 14 de julio de 2026.

## Resultado

El guardado ordinario de una unidad organizativa quedó separado de las operaciones de aprobación y publicación.

### Guardado de contenido

`public.admin_save_organization_unit(jsonb)` conserva el ciclo de vida de una unidad existente. Para unidades nuevas fuerza:

- `status = draft`;
- `visibility = internal`;
- `is_current = true`.

Los campos `status` y `visibility` se eliminan del payload antes de invocar la implementación interna. El endpoint `POST /api/admin/organizacion` rechaza esos campos para evitar que clientes antiguos o manuales omitan el contrato explícito.

### Transiciones explícitas

`public.admin_transition_organization_unit(jsonb)` mantiene las acciones:

- `approve`;
- `publish`;
- `unpublish`;
- `deactivate`;
- `archive`;
- `restore_draft`.

Cada transición aplica permiso, alcance y auditoría específicos.

### Interfaz administrativa

`OrganizationUnitManagerPage` ya no muestra selectores genéricos de estado o visibilidad. La pantalla:

- guarda contenido y jerarquía sin aprobar ni publicar;
- muestra el estado actual como información de solo lectura;
- ofrece únicamente acciones válidas según el estado;
- solicita confirmación para desactivar o archivar;
- actualiza el árbol después de cada transición.

## Validación en Supabase

La función de guardado aplicada en el entorno real:

- elimina `status` y `visibility` del payload ordinario;
- fuerza borrador interno al crear;
- mantiene las unidades vigentes en `draft` e `internal` hasta revisión explícita.

No se promovieron unidades automáticamente.

La normalización posterior dejó 12 jerarquías pastorales diocesanas coherentes, con 12 cabeceras, 180 unidades hijas, 192 unidades alcanzables desde sus raíces y 0 ciclos. La cola `/admin/organizacion/revision` permite filtrar y aprobar unidades revisadas sin publicarlas.

## Estado de cierre técnico

S2-04 está completado técnicamente:

- existe una cola de revisión por lotes;
- las jerarquías fueron normalizadas y verificadas;
- la aprobación permanece separada de la publicación;
- edición, transición y auditoría usan contratos explícitos.

## Pendientes operativos de beta

- Validar permisos con cuentas reales separadas para edición, aprobación y publicación.
- Revisar funcionalmente las 192 unidades por jurisdicción.
- Aprobar únicamente unidades revisadas.
- Publicar, mediante una acción posterior separada, solo los registros autorizados.

Estos controles operativos no reabren el cierre técnico de Sprint 2.
