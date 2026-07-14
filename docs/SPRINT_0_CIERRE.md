# Sprint 0 — Cierre técnico y operativo

**Fecha de revisión:** 14 de julio de 2026  
**Proyecto Supabase:** `sinep-rd` (`hrvgpceqaxujlttpimdz`)  
**Rama operativa:** `main`

## Estado

El Sprint 0 está **técnicamente consolidado**. El cierre operativo definitivo depende de dos acciones manuales: activar la protección contra contraseñas filtradas en Supabase Auth y ejecutar la matriz de humo con usuarios de alcances distintos.

## Evidencia verificada

### Automatización

- CI canónico en verde sobre la línea base `4952c26`.
- E2E / Public accessibility en verde.
- `pnpm check` cubre legado, TypeScript, 236 pruebas y build.
- CodeQL forma parte del workflow canónico.

### Seguridad y permisos

- RLS está habilitado en las tablas críticas auditadas: personas, validación privada, perfiles clericales, cargos, plantillas, niveles/nodos, eventos, unidades organizativas, importaciones, auditoría y asignaciones de roles.
- Las funciones administrativas, de auditoría, importación y organización auditadas no conceden ejecución a `anon`.
- Las implementaciones privilegiadas permanecen en esquemas internos; las fachadas públicas autentican, validan permiso y alcance.
- El bucket `person-photos` tiene políticas controladas de `INSERT`, `UPDATE` y `DELETE` para usuarios autenticados con permisos de personas.
- No existen objetos almacenados ni fotografías huérfanas en el bucket al momento de la revisión.

### Integridad y datos

| Control | Resultado |
|---|---:|
| Plantillas activas | 12 |
| Plantillas activas sin raíz vigente | 0 |
| Nodos vigentes con padre sin edge vigente | 0 |
| Personas ordenadas sin `clergy_profile` | 0 |
| Personas totales | 207 |
| Personas sin `person_private_validation` | 0 |
| Fichas públicas activas sin fotografía | 67 |
| Cargos actuales | 187 |
| Registros de auditoría | 37 |
| Lotes de importación | 4 |
| Unidades organizativas | 181 |
| Eventos canónicos | 1 |
| Eventos de `structure_events` | 0 |

Las 67 fichas sin fotografía no se clasifican automáticamente como error: deben resolverse como pendiente, no aplica, no identificada o dato opcional dentro del trabajo de calidad de datos.

### Rendimiento

Se agregó el índice que faltaba para la clave foránea `organization_units.pastoral_area_id`:

```sql
create index if not exists organization_units_pastoral_area_id_idx
  on public.organization_units (pastoral_area_id)
  where pastoral_area_id is not null;
```

Los avisos restantes del asesor de rendimiento son índices aún no utilizados. No deben eliminarse durante la beta sin observar consultas reales y estadísticas de producción.

### Dependencias

Dependabot continúa proponiendo parches y versiones menores, pero las actualizaciones mayores de `next`, `typescript` y `@types/node` quedan bloqueadas durante la beta. Las migraciones mayores se realizarán en un sprint técnico independiente.

## Pendientes para marcar Sprint 0 como Operativo

### S0-OP-01 — Protección de contraseñas filtradas

Activar manualmente en Supabase:

`Authentication → Security / Password security → Leaked password protection`

El asesor de seguridad no reporta otro hallazgo.

### S0-OP-02 — Matriz de humo con alcance real

Crear o identificar cuentas de prueba para:

1. Administrador nacional.
2. Administrador diocesano A.
3. Administrador diocesano B.
4. Usuario parroquial o de unidad organizativa.
5. Usuario autenticado sin permiso administrativo.

Validar con esas cuentas:

- Login y cierre de sesión.
- Crear o editar una persona dentro del alcance.
- Bloquear la misma operación fuera del alcance.
- Crear una entidad dentro del alcance.
- Registrar una asignación y conservar sucesión.
- Confirmar registro de auditoría.
- Confirmar que el usuario sin permiso recibe `403` o error equivalente.

## Hallazgos que pasan a otros sprints

- Las 181 unidades organizativas están vigentes pero en estado `draft`: su aprobación y publicación corresponden a los Sprint 3, 5 y 7.
- Dos cargos pastorales diocesanos —Director de pastoral y Coordinador de pastoral— no tienen mapeo a niveles estructurales. Debe decidirse en Sprint 3 si se asignan a nivel territorial o exclusivamente a unidades del organigrama pastoral.
- El piloto usa el motor de eventos canónicos; `structure_events` permanece vacío. La convergencia definitiva de ambos contratos corresponde al Sprint 5.
- La clasificación y resolución de fotografías faltantes corresponde al Sprint 6.

## Criterio de cierre

El Sprint 0 se marcará **Operativo** cuando S0-OP-01 y S0-OP-02 estén completados y el CI posterior a estos cambios permanezca en verde.
