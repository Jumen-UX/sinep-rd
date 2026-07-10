# P1 Phase 3 — UI Filtering & Enhanced Auditing: Complete Implementation

## ✅ Status: COMPLETADA

Fecha: 2026-07-11

---

## 📦 Artefactos Implementados

### 1. **Migraciones SQL** (2 archivos)

#### `20260711_p1_phase3_audit_jurisdiction.sql`
- Agrega columna `jurisdiction_id` a `admin_audit_log`
- Crea función `admin_audit_get_jurisdiction_for_entity()` para derivar jurisdicción
- Crea vista `admin_audit_log_with_jurisdiction` para queries enriquecidas
- Crea RPC `admin_audit_log_by_jurisdiction()` para filtrar auditoría por jurisdicción
- Agrega RLS policy para que usuarios solo vean auditoría de su jurisdicción

#### `20260711_p1_phase3_audit_rpc_update.sql`
- Actualiza `admin_write_audit_log()` para aceptar parámetro `p_jurisdiction_id`
- Auto-deriva jurisdicción si no se proporciona explícitamente
- Soporta override explícito cuando sea necesario

### 2. **Helpers TypeScript** (`src/lib/admin/scopeUtils.ts`)

Funciones nuevas para usar en componentes:

| Función | Propósito | Retorna |
|---------|-----------|---------|
| `getUserScope()` | Obtener scope del usuario actual | `UserScope` |
| `getScopeOptionsForUser()` | Opciones de scope para dropdowns | `ScopeOption[]` |
| `filterEntitiesByScope()` | Filtrar lista de entidades | `Entity[]` |
| `isEntityInUserScope()` | Validar que entidad está en scope | `boolean` |
| `getFilteredJurisdictionOptions()` | Obtener opciones de selección | `Entity[]` |
| `getScopeLabel()` | Etiqueta legible del scope | `string` |

**Ejemplo de Uso:**

```typescript
// En un componente server-side (layout, page, etc.)
import { getUserScope, filterEntitiesByScope } from '@/lib/admin/scopeUtils'

export async function AdminDashboard({ userId }: { userId: string }) {
  const supabase = await createClient()
  
  // 1. Obtener scope del usuario
  const userScope = await getUserScope(supabase, userId)
  
  // 2. Filtrar entidades disponibles
  const dioceses = await filterEntitiesByScope(supabase, userId, {
    entityTypeKey: 'diocese'
  })
  
  // 3. Mostrar scope actual
  const scopeLabel = getScopeLabel(userScope)
  
  return (
    <>
      <p>Tu alcance: {scopeLabel}</p>
      <select>
        {dioceses.map(d => <option key={d.id}>{d.name}</option>)}
      </select>
    </>
  )
}
```

### 3. **Tests** (`tests/admin-audit-p1-phase3.test.mjs`)

6 test cases cubriendo:

- **P1.P3.1**: RPC `admin_write_audit_log` sin jurisdicción
- **P1.P3.2**: Derivación de jurisdicción desde `position_assignments`
- **P1.P3.3**: Derivación de jurisdicción desde `ecclesiastical_entities`
- **P1.P3.4**: Query de auditoría filtrada por jurisdicción
- **P1.P3.5**: Vista enriquecida con datos de jurisdicción
- **P1.P3.6**: Override explícito de jurisdicción

---

## 🔧 Cómo Usar en Componentes

### Patrón 1: Server Component (Next.js 13+)

```typescript
// src/app/(admin)/admin/asignaciones/page.tsx
import { getUserScope, filterEntitiesByScope } from '@/lib/admin/scopeUtils'

export default async function AsignacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const scope = await getUserScope(supabase, user!.id)
  const dioceses = await filterEntitiesByScope(supabase, user!.id)
  
  return (
    <>
      {/* Show current user scope */}
      <div className="alert">
        Tu alcance: {getScopeLabel(scope)}
      </div>
      
      {/* Filtered selector */}
      <select defaultValue={scope.scopeEntityId || ''}>
        {dioceses.map(d => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </>
  )
}
```

### Patrón 2: API Endpoint

```typescript
// src/app/api/admin/asignaciones/route.ts
import { requireAdminAccess } from '@/lib/admin/authorization'
import { getUserScope } from '@/lib/admin/scopeUtils'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess()
  if (!auth.ok) return auth.response
  
  const scope = await getUserScope(auth.supabase, auth.user!.id)
  
  // Only allow super/national admins or users in same scope
  const entityId = request.nextUrl.searchParams.get('entity_id')
  
  if (!scope.isUnrestricted && entityId !== scope.scopeEntityId) {
    return NextResponse.json(
      { error: 'No autorizado para esta entidad' },
      { status: 403 }
    )
  }
  
  // Process request...
  return NextResponse.json({ /* ... */ })
}
```

### Patrón 3: Validación Pre-RPC

```typescript
// Antes de llamar a admin_save_position_assignment
const { isValid } = await checkEntityInScope(
  supabase,
  ecclesiastical_entity_id,
  user_id
)

if (!isValid) {
  throw new Error('Entity está fuera de tu alcance')
}

// Solo entonces llamar RPC
const result = await supabase.rpc(
  'admin_save_position_assignment', 
  { payload }
)
```

---

## 📊 Auditoría Mejorada

### Cómo Fluye Ahora

```
User Action
  ↓
RPC (admin_save_position_assignment, etc.)
  ↓
recordAdminAudit(supabase, {
  action: 'position_assignment.create',
  targetTable: 'position_assignments',
  targetId: new_assignment_id,
  metadata: { ... }
})
  ↓
admin_write_audit_log()
  ├─ p_target_table = 'position_assignments'
  ├─ p_target_id = new_assignment_id
  └─ Calls: admin_audit_get_jurisdiction_for_entity()
      → Derives ecclesiastical_entity_id from assignment
      ↓
admin_audit_log row created with jurisdiction_id ✅
```

### Queries de Auditoría

#### Obtener auditoría de una diócesis específica

```sql
select * from admin_audit_log_by_jurisdiction('uuid-diocesis-sd', 100)
order by created_at desc
```

#### Ver auditoría con detalles de jurisdicción

```sql
select 
  action,
  jurisdiction_name,
  target_table,
  created_at
from admin_audit_log_with_jurisdiction
where jurisdiction_id = 'uuid-diocesis-sd'
order by created_at desc
```

#### Comparación de auditoría entre diócesis

```sql
select 
  jurisdiction_name,
  count(*) as action_count,
  count(distinct actor_user_id) as unique_admins
from admin_audit_log_with_jurisdiction
where created_at > now() - interval '7 days'
group by jurisdiction_name
```

---

## 🔐 Seguridad: RLS Policy

```sql
create policy admin_audit_log_jurisdiction_check
  on public.admin_audit_log
  for select
  using (
    current_user_has_admin_role()
    and (
      -- User can see:
      -- 1. Logs with no jurisdiction (global actions)
      -- 2. Logs for their jurisdiction or its descendants
      jurisdiction_id is null
      or current_user_has_scope_for_entity(jurisdiction_id)
    )
  );
```

**Efecto:**
- Admin diocesano de SD solo ve auditoría de SD
- Admin diocesano de SD NO VE auditoría de Santiago
- Super_admin ve todas las auditorías

---

## 📋 Checklist de Integración

- [ ] Reemplazar queries hardcodeadas a `ecclesiastical_entities` con `filterEntitiesByScope()`
- [ ] Agregar `getScopeLabel()` en UI para mostrar alcance actual
- [ ] Validar entidades con `isEntityInUserScope()` antes de RPC
- [ ] Agregar vista de auditoría por jurisdicción en `/admin/revision`
- [ ] Actualizar componentes principales:
  - `StructureEntityPicker.tsx` - filtrar por scope
  - `EntityHierarchyPicker.tsx` - mostrar solo entidades accesibles
  - `src/app/(admin)/admin/asignaciones/page.tsx`
  - `src/app/(admin)/admin/nuevo/parroquia/page.tsx`
  - `src/app/(admin)/admin/nuevo/capilla/page.tsx`

---

## 🚀 Deployment

```bash
# 1. Aplicar migraciones
supabase db push

# 2. Ejecutar tests
pnpm test -- tests/admin-audit-p1-phase3.test.mjs

# 3. Verificar en UI que se filtra correctamente
# (Componentes aún necesitan actualización)
```

---

## 📈 Impacto de P1 Fases 1-3

```
Antes (Global Admin)          Después (P1 - Granular)
─────────────────────         ──────────────────────
Admin ve TODO                 Admin ve SOLO su jurisdicción
  ├─ Todas las diócesis         ├─ Su diócesis
  ├─ Todas las personas         ├─ Personas en su diócesis
  └─ Todos los cargos           └─ Cargos en su diócesis

Sin auditoría de scope       Con auditoría de jurisdicción
  ├─ ¿Quién modificó qué?       ├─ ¿Quién modificó qué EN DÓNDE?
  └─ Sin contexto jurisd.       └─ Fácil rastreo por jurisdicción

Sin RLS de scope              Con RLS de scope
  └─ Validación solo en RPC     ├─ Validación en RPC (P1 Fase 2)
                                 └─ + Validación en BD (RLS) ✅
```

---

## 📝 Referencia Rápida

```typescript
// Obtener scope
const scope = await getUserScope(supabase, userId)
// → { isUnrestricted, scopeType, scopeEntityId, scopeName }

// Filtrar entidades
const entities = await filterEntitiesByScope(supabase, userId)
// → Entity[]

// Validar entidad
const isInScope = await isEntityInUserScope(supabase, userId, entityId)
// → boolean

// Etiqueta legible
const label = getScopeLabel(scope)
// → "Diócesis: Santo Domingo"

// Opciones para selectors
const options = await getFilteredJurisdictionOptions(supabase, scope, {
  includeChildren: true
})
// → Entity[]
```

---

**P1 Fases 1, 2, y 3 COMPLETADAS** ✅

**Siguiente:** P1 Fase 3.5 (Integración en componentes UI) o P2 (Testing automatizado)
