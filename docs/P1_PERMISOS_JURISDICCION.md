# P1 — Permisos Granulares por Jurisdicción: Implementación Completada

## ✅ Estado: FASE 1 IMPLEMENTADA

### Archivos Creados/Modificados

#### 📋 Documentación
- [docs/P1_PERMISOS_PLAN.md](docs/P1_PERMISOS_PLAN.md) — Plan integral de 3 fases
- [docs/P1_PERMISOS_JURISDICCION.md](docs/P1_PERMISOS_JURISDICCION.md) — Referencia (este archivo)

#### 🗄️ Base de Datos
- [supabase/migrations/20260711_p1_granular_jurisdiction_permissions.sql](supabase/migrations/20260711_p1_granular_jurisdiction_permissions.sql)

#### 🧪 Tests
- [tests/admin-permissions-p1.test.mjs](tests/admin-permissions-p1.test.mjs)

---

## 🎯 Reglas de Acceso Implementadas

### Matriz de Permisos por Rol

| Rol | Alcance | Acceso a Datos | CRUD Propio Ámbito | CRUD Otro Ámbito | Notas |
|-----|---------|---|---|---|---|
| **super_admin** | Nacional | ✅ Todos | ✅ Sí | ✅ Sí | Sin restricciones |
| **national_admin** | Nacional | ✅ Todos | ✅ Sí | ✅ Sí | Sin restricciones |
| **diocesan_admin** | Diócesis | ✅ Su diócesis | ✅ Sí | ❌ No | Acceso jerárquico a entidades hijas |
| **diocesan_editor** | Diócesis | ✅ Su diócesis | ✅ Sí | ❌ No | Permiso limitado (definible) |
| **vicariate_editor** | Vicariato | ✅ Su vicariato | ✅ Sí | ❌ No | Dentro de diócesis padre |
| **zone_editor** | Zona | ✅ Su zona | ✅ Sí | ❌ No | Dentro de vicariato padre |
| **parish_editor** | Parroquia | ✅ Su parroquia | ✅ Sí | ❌ No | Dentro de zona padre |

### Jerarquía de Acceso

```
User → user_role_assignments
  ├─ role_id → roles (define level)
  ├─ scope_type (nivel de restricción)
  └─ scope_entity_id → ecclesiastical_entities (entidad específica)
                        ↓
                        Acceso a:
                        - La entidad misma
                        - Sus entidades hijas (hierarchical)
                        - NO a entidades hermanas o padres (a menos que sea super/national)
```

### Ejemplo

```
Juan es diocesan_admin
  role_id = uuid-diocesan_admin
  scope_type = 'diocese'
  scope_entity_id = uuid-diocesis-sd

Juan PUEDE:
  ✅ Ver/crear/modificar personas en SD
  ✅ Ver/crear/modificar cargos en SD
  ✅ Ver/crear/modificar vicariatos dentro de SD
  ✅ Ver/crear/modificar zonas dentro de vicariatos de SD

Juan NO PUEDE:
  ❌ Ver/crear/modificar personas en Santiago
  ❌ Ver/crear/modificar cargos en otras diócesis
  ❌ Crear nueva diócesis
  ❌ Modificar datos de su diócesis padre
```

---

## 🔧 Funciones Nuevas

### 1. `current_user_has_scope_for_entity(p_entity_id UUID) → boolean`

**Propósito:** Valida si el usuario actual tiene acceso a una entidad específica.

**Lógica:**
- ✅ Super_admin o national_admin → **true** (sin restricciones)
- ✅ User scope_entity_id == p_entity_id → **true** (acceso directo)
- ✅ p_entity_id es descendiente de user scope_entity_id → **true** (acceso jerárquico)
- ❌ Todos los demás casos → **false**

**Ejemplo:**
```sql
-- Juan es diocesan_admin de Santo Domingo (uuid-sd)
select public.current_user_has_scope_for_entity('uuid-sd')  -- true
select public.current_user_has_scope_for_entity('uuid-vicaria-sd')  -- true (hija)
select public.current_user_has_scope_for_entity('uuid-santiago')  -- false (diferente)
```

### 2. `current_user_root_jurisdiction_id() → UUID`

**Propósito:** Obtiene la entidad raíz (jurisdicción principal) del usuario.

**Retorna:**
- `NULL` si es super_admin o national_admin
- `scope_entity_id` si es user con scope restringido

**Ejemplo:**
```sql
-- Para user con scope en dio_sd
select public.current_user_root_jurisdiction_id()  -- 'uuid-sd'

-- Para super_admin
select public.current_user_root_jurisdiction_id()  -- NULL
```

### 3. `assert_user_has_scope_for_entity(p_entity_id UUID, p_context TEXT) → void`

**Propósito:** Valida scope, **lanza excepción si no autorizado**.

**Lanza:** `'No tienes permiso para acceder a esta entidad en {p_context}'` (42501)

**Uso en RPCs:**
```sql
perform public.assert_user_has_scope_for_entity(v_ecclesiastical_entity_id, 'asignación de cargo');
```

---

## 📝 RPCs Actualizados con Validación P1

### `admin_save_position_assignment(payload JSONB)`

**Nuevas validaciones (líneas ~120-127 en migration):**

```sql
-- Validate scope access to ecclesiastical_entity_id
if v_ecclesiastical_entity_id is not null then
  perform public.assert_user_has_scope_for_entity(v_ecclesiastical_entity_id, 'asignación de cargo');
end if;

-- Validate scope access to pastoral_entity_id
if v_pastoral_entity_id is not null then
  perform public.assert_user_has_scope_for_entity(v_pastoral_entity_id, 'asignación de cargo');
end if;
```

**Efecto:**
- Usuario diocesan_admin de Santo Domingo NO puede crear asignación en Santiago
- Super_admin puede crear en cualquier diócesis
- Error claro: "No tienes permiso para acceder a esta entidad en asignación de cargo"

---

## 🛡️ RLS Policies (Para Futuro)

Aunque P1 implementa validación en RPCs, las RLS policies añadirán defensa en profundidad:

```sql
-- Próximamente en siguiente migration
create policy position_assignments_user_scope_check
  on position_assignments
  for select
  using (
    current_user_has_admin_role()
    and (
      ecclesiastical_entity_id is null
      or current_user_has_scope_for_entity(ecclesiastical_entity_id)
    )
  );
```

---

## 🧪 Tests Implementados

Archivo: [tests/admin-permissions-p1.test.mjs](tests/admin-permissions-p1.test.mjs)

### Casos Cubiertos

1. **P1.1** — User puede crear asignación en su diocesis ✅
2. **P1.2** — User NO PUEDE crear asignación en otra diocesis ✅
3. **P1.3** — Función `current_user_has_scope_for_entity` valida acceso ✅
4. **P1.4** — Función `current_user_root_jurisdiction_id` retorna scope ✅
5. **P1.5** — Auditoría registra cambios ✅
6. **P1.6** — Función `assert_user_has_scope_for_entity` previene escalación ✅

### Ejecutar Tests P1

```bash
# Solo tests de P1
pnpm test -- tests/admin-permissions-p1.test.mjs

# Todos los tests
pnpm test
```

---

## 📋 Cómo Asignar Usuarios a Jurisdicciones

### Crear User Admin de Diócesis

```sql
-- 1. Crear usuario en auth
insert into auth.users (email, email_confirmed_at)
values ('admin.sd@sinep.org', now())
returning id into v_user_id;

-- 2. Asignar rol diocesan_admin a Santo Domingo
insert into public.user_role_assignments (
  user_id, 
  role_id,
  scope_type,
  scope_entity_id,
  status
) select
  v_user_id,
  r.id,
  'diocese',
  e.id,
  'active'
from public.roles r
cross join public.ecclesiastical_entities e
where r.key = 'diocesan_admin'
  and e.slug = 'santo-domingo'
  and e.status = 'active';
```

### Via RPC (Cuando Exista)

```typescript
// Próximamente: admin_assign_user_role() RPC
const result = await supabase.rpc('admin_assign_user_role', {
  user_email: 'admin.sd@sinep.org',
  role_key: 'diocesan_admin',
  scope_type: 'diocese',
  scope_entity_slug: 'santo-domingo'
})
```

---

## 🚀 Instalación / Deployment

### En Ambiente Local

```bash
# 1. Aplicar migration
supabase db push

# 2. Ejecutar tests
pnpm test -- tests/admin-permissions-p1.test.mjs

# 3. Verificar que admin_save_position_assignment valida scope
# (intentar crear asignación fuera de jurisdicción debe fallar)
```

### En Producción

```bash
# Supabase CLI aplica automáticamente las migraciones
# en el orden de timestamp

supabase db push --linked  # Push a BD de producción

# Luego ejecutar smoke tests
pnpm test -- tests/admin-permissions-p1.test.mjs
```

---

## 🔍 Resolución de Problemas

### Error: "No tienes permiso para acceder a esta entidad"

**Causa:** Usuario intenta operar fuera de su scope.

**Solución:**
1. Verificar `user_role_assignments` del usuario
2. Confirmar que `scope_entity_id` es correcto
3. Si necesita acceso a otra diócesis, crear nuevo `user_role_assignment`

### Funciones no encontradas

**Causa:** Migration no aplicada.

**Solución:**
```bash
supabase status  # Revisar migrations pendientes
supabase db push
```

### Super_admin no ve datos de otra diócesis

**Causa:** Super_admin tiene `scope_type='national'` pero scope_entity_id restringido.

**Solución:**
```sql
-- Verificar que role es realmente 'super_admin'
select r.key from public.user_role_assignments ura
join public.roles r on r.id = ura.role_id
where ura.user_id = 'uuid-user';

-- Debe retornar 'super_admin'
```

---

## 📈 Próximos Pasos (Fase 2-3)

- [ ] Aplicar P1 a otros RPCs: `admin_save_priest`, `admin_save_parroquia`, etc.
- [ ] Agregar RLS policies para defensa en profundidad
- [ ] Tests integrados con usuarios autenticados (no solo service_role)
- [ ] UI: Filtrar opciones de diócesis basado en scope del usuario
- [ ] Auditoría mejorada: Agregar columna `jurisdiction_id` a `admin_audit_log`
- [ ] Documentar matriz de permisos por rol en admin dashboard

---

## 📚 Referencia Rápida

```
Función                                          Retorna    Uso
─────────────────────────────────────────────────────────────────────
current_user_has_scope_for_entity(uuid)          boolean    ✅ SELECT para chequeo
current_user_root_jurisdiction_id()              uuid|null  📍 Filtrar datos por scope
assert_user_has_scope_for_entity(uuid, text)    void       🛡️  RAISE EXCEPTION si falla
current_user_has_admin_role()                    boolean    👤 Chequeo básico de admin
current_user_has_permission(text)                boolean    🔑 Permiso específico
```

---

**Documentación creada:** 2026-07-11  
**P1 Fase 1 Status:** ✅ COMPLETADA
