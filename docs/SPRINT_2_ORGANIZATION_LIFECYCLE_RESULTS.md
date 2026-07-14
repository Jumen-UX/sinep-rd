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
- mantiene 181 unidades vigentes en `draft` e `internal` hasta revisión explícita.

No se promovieron unidades automáticamente.

## Pendientes para cerrar S2-04

- Crear una cola de revisión por lotes para las 181 unidades en borrador.
- Definir criterios funcionales de aprobación por organigrama y diócesis.
- Validar permisos con cuentas reales separadas para edición, aprobación y publicación.
- Aprobar y publicar solo registros revisados.
