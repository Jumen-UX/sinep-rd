# P1 — Permisos Granulares por Jurisdicción: Plan de Implementación

## Estado Actual

### ✅ Ya Implementado
- Tabla `user_role_assignments` con `scope_type` y `scope_entity_id`
- Función `current_user_has_admin_role()` que valida rol admin
- Función `current_user_has_permission(permission_key)` para validar permisos específicos
- RLS policies básicas que validan `current_user_has_admin_role()`
- Auditoría en `admin_audit_log`

### ❌ Pendiente — P1
- Función de validación de scope: `current_user_has_scope_for_entity(entity_id)`
- Aplicar validación de scope en todos los RPCs administrativos
- Tests para verificar que users de una diocesis no pueden ver/modificar datos de otra
- Documentar reglas de acceso por rol y jurisdicción

---

## Arquitectura de Solución

### 1. Función Base: `current_user_has_scope_for_entity()`

**Propósito:** Validar que el usuario actual tiene permiso de acceso a una entidad específica basado en su jurisdicción.

```sql
create or replace function public.current_user_has_scope_for_entity(p_entity_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  -- Si el usuario es super_admin o national_admin, acceso a todo
  select exists (
    select 1 from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and (ura.ends_at is null or ura.ends_at >= now())
      and r.key in ('super_admin', 'national_admin')
  )
  or
  -- Si el usuario tiene scope restringido, validar:
  -- 1. Acceso directo: scope_entity_id = p_entity_id
  -- 2. Acceso jerárquico: p_entity_id está dentro del árbol de scope_entity_id
  exists (
    select 1 from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and (ura.ends_at is null or ura.ends_at >= now())
      and (
        -- Acceso directo
        ura.scope_entity_id = p_entity_id
        -- O acceso jerárquico (parent-child)
        or exists (
          select 1 from public.entity_relationships er
          where er.parent_entity_id = ura.scope_entity_id
            and er.child_entity_id = p_entity_id
            and er.is_current = true
            and er.status = 'active'
        )
      )
  )
$$;
```

### 2. Función Auxiliar: `current_user_root_jurisdiction_id()`

**Propósito:** Obtener la entidad raíz del usuario (su diócesis, si es admin diocesano).

```sql
create or replace function public.current_user_root_jurisdiction_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select ura.scope_entity_id
  from public.user_role_assignments ura
  where ura.user_id = auth.uid()
    and ura.status = 'active'
    and (ura.ends_at is null or ura.ends_at >= now())
  limit 1
$$;
```

---

## RPCs Críticos que Requieren Validación de Scope

### Lista de RPCs a Proteger

| RPC | Tabla | Validación Requerida |
|-----|-------|---------------------|
| `admin_save_position_assignment` | `position_assignments` | Validar scope de `ecclesiastical_entity_id` |
| `admin_save_priest` | `persons`, `position_assignments` | Validar scope de entidad del cargo |
| `admin_save_parroquia` | `ecclesiastical_entities` | Validar scope de parent entity |
| `admin_mark_person_deceased` | `persons` | Validar scope de persona (a través de su cargo) |
| `admin_save_office_configuration` | `office_configurations` | Validar scope de entidad |
| Cualquier RPC que modifique datos eclesiales | - | Agregar validación de scope |

---

## Implementación: 3 Fases

### ✅ Fase 1: Funciones Base (COMPLETADA)
- ✅ Crear `current_user_has_scope_for_entity()`
- ✅ Crear `current_user_root_jurisdiction_id()`
- ✅ Crear función helper para validar scope en transaction
- ✅ Tests unitarios
- **Archivo:** `supabase/migrations/20260711_p1_granular_jurisdiction_permissions.sql`

### ✅ Fase 2: Integración en RPCs (COMPLETADA)
- ✅ Agregar validación de scope a `admin_save_position_assignment` (crítico)
- ✅ Agregar validación a `admin_save_priest`, `admin_save_deacon`, `admin_save_religious`
- ✅ Tests de integridad: usuario A no puede modificar datos de usuario B
- **Archivos:** 
  - `supabase/migrations/20260711_p1_phase2_scope_validation_rpcs.sql`
  - `tests/admin-rpc-p1-phase2.test.mjs`

### ⏳ Fase 3: UI y Auditoría (Próxima semana)
- Filtrar opciones de sección en UI basado en scope del usuario
- Agregar columna `jurisdiction_id` a `admin_audit_log` para rastreabilidad
- Tests de autorización en endpoints API

---

## Criterio de Aceptación — P1

- [ ] Usuario diocesano puede CRUD dentro de su diócesis
- [ ] Usuario diocesano NO PUEDE ver datos de otra diócesis
- [ ] Usuario diocesano NO PUEDE modificar datos de otra diócesis
- [ ] Super admin accede a todo
- [ ] Cambio de scope es auditado con nuevo alcance
- [ ] Intentos de acceso no autorizado generan error 403 con contexto
- [ ] RLS policies previenen escalación incluso si RPC falla
- [ ] Tests cubren: mismo scope ✓, scope diferente ✗, super_admin ✓

---

## Estructura de Artefactos

```
supabase/migrations/
  20260711_*.sql
    - Crear funciones de validación de scope
    - Agregar RLS policies granulares por jurisdicción
    - Actualizar admin_audit_log con jurisdiction_id

src/lib/admin/
  authorization.ts (actualizar)
    - Agregar validación de scope en requireAdminAccess()
    - Agregar helper validateScope()

tests/
  admin-permissions.test.mjs (NUEVO)
    - Tests de acceso por jurisdicción
    - Tests de escalación fallida
    - Tests de auditoría de scope

docs/
  P1_PERMISOS_JURISDICCION.md (NUEVO)
    - Reglas de acceso por rol
    - Matriz de permisos
    - Cómo asignar usuarios a jurisdicciones
```

---

## Próximo Paso Inmediato

1. ✅ Revisar estructura existente (COMPLETADO)
2. ⏳ Crear migration con funciones de validación de scope
3. ⏳ Crear migration con RLS policies granulares
4. ⏳ Implementar tests de P1
5. ⏳ Documentar reglas de acceso

**Confirmación:** ¿Proceder con Fase 1 (funciones base)?
