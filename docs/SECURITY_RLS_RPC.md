# Seguridad, RLS y RPC — Línea base

Este documento define las reglas de seguridad iniciales para SINEP RD.

## Objetivo

Proteger datos sensibles, evitar exposición accidental por la Data API de Supabase y centralizar operaciones críticas en RPC controladas.

## Estado auditado

La base de datos tiene RLS activado en las tablas públicas revisadas.

También existen funciones RPC administrativas y lectoras para:

- Guardar personas por tipo.
- Guardar entidades eclesiásticas.
- Guardar jurisdicciones.
- Guardar configuraciones de cargos.
- Guardar nombramientos.
- Guardar plantillas, niveles y nodos estructurales.
- Leer árboles y opciones del motor de estructuras.

## Regla principal

Toda tabla pública debe tener RLS activo.

```sql
alter table public.nombre_tabla enable row level security;
```

No se deben crear tablas nuevas en `public` sin:

1. RLS activo.
2. Políticas explícitas.
3. Grants revisados.
4. Índices para columnas usadas en políticas.
5. Revisión del Supabase Advisor.

## Datos públicos vs datos privados

Los datos públicos pueden vivir en tablas públicas con RLS y visibilidad controlada.

Los datos privados deben separarse en tablas específicas y quedar fuera de vistas públicas.

Ejemplos de datos privados:

- Documentos de identidad.
- Datos familiares.
- Datos de contacto no publicados.
- Validaciones internas.
- Notas administrativas.
- Campos usados solo para auditoría o revisión.

## RPC administrativas

Las operaciones administrativas deben seguir este patrón:

```txt
public.admin_* RPC
  ↓
internal.admin_* función transaccional
  ↓
validación de rol/permiso
  ↓
escritura controlada
```

Las RPC públicas administrativas pueden estar disponibles para usuarios autenticados, pero la función interna debe validar permisos antes de modificar datos.

## Funciones SECURITY DEFINER

No se deben exponer funciones `SECURITY DEFINER` en esquemas disponibles por la Data API si pueden ser ejecutadas por `anon` o `authenticated` sin una justificación clara.

Riesgo:

```txt
/rest/v1/rpc/nombre_funcion
```

Una función `SECURITY DEFINER` expuesta puede convertirse en un endpoint de escalamiento de privilegios si no valida estrictamente al usuario.

## Funciones helper de autorización

Los helpers públicos de autorización deben ser simples y revisables.

Ejemplos:

- `current_user_is_admin()`
- `current_user_has_permission(text)`
- `current_user_has_role(text[])`
- `can_view_visibility(text)`

Cualquier helper usado por RLS debe ser estable, mínimo y no devolver información sensible.

## Esquemas internos

Los esquemas internos deben usarse para implementación, no para API pública.

Recomendación de largo plazo:

```txt
api       → funciones/vistas explícitamente expuestas
public    → tablas y vistas públicas con RLS
internal  → RPC administrativas internas
private   → helpers y datos privados no expuestos
```

El proyecto actualmente conserva compatibilidad con funciones públicas existentes. La refactorización hacia un esquema `api` dedicado debe hacerse de forma controlada para no romper clientes existentes.

## Reglas para políticas RLS

Las políticas deben:

- Especificar roles con `to anon` o `to authenticated` cuando sea posible.
- Usar `auth.uid()` envuelto en `select` para mejorar performance cuando aplique.
- Evitar múltiples políticas permisivas para el mismo rol y acción cuando puedan consolidarse.
- Separar lectura pública de lectura administrativa.
- No depender de campos modificables por el usuario para permisos críticos.

## Reglas para formularios administrativos

Los formularios administrativos no deben escribir directo en tablas críticas desde el frontend.

Deben usar RPC cuando la operación:

- Crea múltiples filas.
- Requiere historial.
- Cambia relaciones jerárquicas.
- Modifica cargos o nombramientos.
- Afecta datos privados.
- Cambia estado canónico/pastoral.
- Necesita auditoría.

## Reglas para Storage

Buckets con fotos o documentos deben distinguir entre:

| Tipo | Regla |
|---|---|
| Foto pública | Lectura pública si la persona/entidad es pública. |
| Foto privada | Lectura solo para usuarios autorizados. |
| Documento fuente público | Lectura pública si la fuente es pública. |
| Documento administrativo | Lectura solo por permisos internos. |

Nunca se debe subir documentación privada a un bucket público sin política específica.

## Advisor de Supabase

Después de cambios DDL o RLS se debe revisar:

```txt
Security Advisor
Performance Advisor
```

Estado tras esta revisión:

- RLS activo en tablas públicas revisadas.
- Motor de estructuras existente y protegido por RLS.
- RPC administrativas internas con validación de rol administrativo.
- Advertencia pendiente: protección contra contraseñas filtradas desactivada en Supabase Auth.

## Pendiente manual en Supabase Auth

Activar protección contra contraseñas filtradas:

```txt
Supabase Dashboard
→ Authentication
→ Security / Password security
→ Leaked password protection
```

Esta opción no debe resolverse con SQL de aplicación; debe activarse desde la configuración de Auth del proyecto.
