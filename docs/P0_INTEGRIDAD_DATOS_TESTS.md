# P0 — Integridad de Datos: Tests y Validación

## Criterio de Aceptación — P0

**Regla fundamental:** No pueden coexistir dos asignaciones `is_current=true` para el mismo cargo y el mismo ámbito eclesial.

### Garantías implementadas

1. **Trigger automático** (`position_assignments_close_previous_current`)
   - Al insertar una asignación con `is_current=true`, cierra automáticamente cualquier asignación previa actual en el mismo ámbito
   - Actualiza `assignment_status` a `replaced` si es `active`/`term_expired_still_serving`/`vacant`
   - Establece `replaced_by_assignment_id` y `successor_assignment_id` a la nueva asignación

2. **Índice único parcial** (`uniq_position_assignments_current_scope`)
   - Previene que se creen duplicados concurrentes en la misma transacción
   - Solo aplica a registros con `is_current=true` y `record_status='active'`
   - Cubre: `office_configuration_id` + `organization_chart_id` + `organization_unit_id` + `ecclesiastical_entity_id` + `pastoral_entity_id`

3. **RPC transaccional** (`admin_save_position_assignment`)
   - Valida todos los campos antes de insertar
   - Maneja `close_previous_current` para cerrar previamente asignaciones actuales
   - Soporta vinculación con asignaciones predecesora y sucesora
   - Retorna JSON con `assignment_id` para confirmación

4. **Traducción de errores**
   - Todos los errores de validación se traducen a español
   - Los mensajes de PostgreSQL se convierten a texto legible mediante `toSpanishAdminError()`

5. **Auditoría**
   - Cada cambio en `position_assignments` es registrado en `admin_audit_log`
   - Incluye usuario, acción, tabla, ID del registro y metadatos

---

## Ejecución de Tests

### Requisitos previos

1. Variables de entorno configuradas en `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

2. Todas las migraciones de Supabase aplicadas (ejecutar `supabase db push`)

3. Node.js 22.x

### Ejecutar tests completos

```bash
# Tests unitarios + integridad + RPC
pnpm test

# Solo tests de integridad de posición
pnpm test -- tests/position-assignments.test.mjs

# Solo tests del RPC administrativo
pnpm test -- tests/admin-rpc-position-assignments.test.mjs

# Solo tests de validación
pnpm test -- tests/admin-validation.test.mjs
```

### Ejecución detallada con logs

```bash
NODE_DEBUG=* pnpm test -- tests/position-assignments.test.mjs --verbose
```

---

## Suite de Tests: `position-assignments.test.mjs`

Prueba el comportamiento automático del trigger y el índice.

### P0.1: Direct insert of second current assignment auto-closes first (trigger)
- **Escenario:** Insertar 2 asignaciones actuales para el mismo cargo/ámbito
- **Validación:**
  - La segunda inserción debe tener éxito
  - La primera debe cambiar a `is_current=false` y `assignment_status='replaced'`
  - Debe existir exactamente 1 asignación actual

### P0.2: Unique partial index prevents duplicates on concurrent inserts
- **Escenario:** Intentar insertar dos asignaciones actuales rápidamente
- **Validación:**
  - El índice debe rechazar la segunda con error de constraint (code 23505) o el trigger debe cerrar la primera

### P0.3: Closing assignment updates replaced_by and assignment_status
- **Escenario:** Verificar que los campos de vinculación se actualizan correctamente
- **Validación:**
  - `replaced_by_assignment_id` debe apuntar a la nueva asignación
  - `successor_assignment_id` debe apuntar a la nueva asignación
  - `actual_end_date` debe establecerse

### P0.4: Non-current assignments are not affected by trigger
- **Escenario:** Insertar una asignación no-actual, luego una actual
- **Validación:**
  - La asignación no-actual no debe cambiar
  - La asignación actual debe quedar como está

### P0.5: Different office scopes do not interfere
- **Escenario:** Crear asignaciones actuales para 2 cargos diferentes
- **Validación:**
  - Ambas deben permanecer como `is_current=true`
  - No debe haber interferencia entre ámbitos diferentes

---

## Suite de Tests: `admin-rpc-position-assignments.test.mjs`

Prueba el RPC transaccional y sus validaciones.

### P0.RPC.1: Save position assignment creates record with is_current=true when no end date
- **Validación:** Un RPC sin `actual_end_date` debe crear una asignación con `is_current=true`

### P0.RPC.2: Save position assignment with actual_end_date sets is_current=false
- **Validación:** Un RPC con `actual_end_date` debe crear una asignación con `is_current=false`

### P0.RPC.3: Vacant position does not require person_id
- **Validación:** Un cargo vacante puede crearse sin persona
- **Otros:** Debe tener `is_current=true` y `assignment_status='vacant'`

### P0.RPC.4: close_previous_current flag closes previous current assignments
- **Validación:** El flag `close_previous_current=true` debe cerrar asignaciones previas
- **Otros:** Debe establecer `replaced_by_assignment_id` y cambiar status a `replaced`

### P0.RPC.5: Invalid office_configuration_id is rejected
- **Validación:** El RPC rechaza IDs de cargo que no existen
- **Mensaje esperado:** "no existe" o "no activo"

### P0.RPC.6: Non-vacant assignment requires person_id
- **Validación:** El RPC rechaza asignaciones no-vacantes sin persona
- **Mensaje esperado:** "persona" o "excepto cuando"

---

## Checklist de Validación — P0 COMPLETADO

- [x] Trigger automático implementado y probado
- [x] Índice único parcial implementado
- [x] RPC transaccional implementado con validaciones
- [x] Traducción de errores a español
- [x] Auditoría de cambios registrada
- [x] Tests unitarios de integridad (5 casos)
- [x] Tests del RPC administrativo (6 casos)
- [x] Documentación de criterio de aceptación
- [ ] Ejecución en CI/CD

---

## Integración en CI/CD

Agregar a `.github/workflows/test.yml` (o similar):

```yaml
- name: Run integrity tests
  run: pnpm test -- tests/position-assignments.test.mjs tests/admin-rpc-position-assignments.test.mjs
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## Resolución de Problemas

### Error: "Missing environment variables"
```
Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or shell
```

### Error: "No autorizado para guardar asignaciones"
```
El usuario en el RPC no tiene rol de administrador.
El service role key debe estar configurado correctamente.
```

### Error: "El cargo configurado no existe"
```
Las migraciones no se ejecutaron completamente.
Ejecutar: supabase db push
```

### Test timeout
```
Las RPCs están lentamente respondiendo.
Revisar conexión a Supabase y logs de la base de datos.
```

---

## Siguiente paso

Implementar **P1** (Permisos granulares por jurisdicción) con las mismas garantías transaccionales.
