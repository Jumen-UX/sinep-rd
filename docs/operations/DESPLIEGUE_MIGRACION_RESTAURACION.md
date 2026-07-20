# Guía de despliegue, migración y restauración

> Estado: vigente para beta interna
> Última revisión: 2026-07-20
> Responsable: operaciones y plataforma

## Alcance

Esta guía conecta el commit versionado, las migraciones de Supabase y el despliegue de Vercel. No sustituye la política de respaldo ni demuestra que una restauración real haya sido ejecutada; esa evidencia se conserva según [Operación y recuperación](../OPERACION_Y_RECUPERACION.md).

## Precondiciones

Antes de promover un cambio:

1. identificar el commit exacto;
2. confirmar `CI` en verde para ese commit;
3. ejecutar `pnpm install --frozen-lockfile` y `pnpm check` cuando se valide localmente;
4. revisar el reporte de `pnpm audit:migrations:strict` si el cambio toca `supabase/migrations`;
5. confirmar que el entorno objetivo y sus variables corresponden a la beta;
6. obtener un respaldo o punto de restauración verificable antes de una migración destructiva;
7. registrar responsable, fecha, entorno y ventana de cambio.

## Variables de entorno

| Variable | Exposición | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | pública | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | clave publicable del cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública, compatibilidad | alternativa heredada a la clave publicable |
| `APP_BASE_URL` | servidor | origen canónico y redirecciones |
| `PUBLIC_INDEXING_ENABLED` | servidor | apertura controlada de robots y sitemap |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto de servidor | invitación y recuperación administrativa |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | secreto de operación | health check de despliegues protegidos |

Nunca declarar `SUPABASE_SERVICE_ROLE_KEY` ni secretos de automatización con prefijo `NEXT_PUBLIC_`. Las credenciales E2E se almacenan como secretos protegidos y solo apuntan a entornos autorizados.

## Migraciones de Supabase

1. Revisar el archivo nuevo y su orden temporal.
2. Confirmar que no se editó una migración ya aplicada.
3. Ejecutar `pnpm audit:migrations:strict`.
4. Aplicar la migración mediante el mecanismo autorizado del entorno, en el orden versionado.
5. Verificar las invariantes y consultas diagnósticas incluidas en el cambio.
6. Confirmar que no quedan migraciones pendientes inesperadas.
7. Ejecutar los asesores de seguridad y rendimiento cuando el cambio afecte esquema, funciones, políticas o índices.
8. Registrar el commit y la migración aplicados.

Una migración fallida se corrige con una migración posterior reproducible. No se borra el historial ni se improvisan cambios manuales sobre las tablas canónicas.

## Despliegue de la aplicación

1. Confirmar que Vercel construirá el mismo commit validado por CI.
2. Revisar variables de Preview o Production sin copiar valores secretos al reporte.
3. Mantener Deployment Protection mientras la beta no tenga autorización pública.
4. Promover el despliegue.
5. Ejecutar `HEALTH_BASE_URL=<url> pnpm health:check`.
6. Ejecutar el E2E público y Axe contra la URL autorizada.
7. Realizar un recorrido administrativo no mutante con una cuenta de prueba.
8. Registrar URL, commit, resultado, hora y artefactos.

`PUBLIC_INDEXING_ENABLED` permanece en `false` hasta una decisión formal de apertura.

## Retroceso

### Aplicación

Si el incidente fue introducido por código:

1. detener nuevas promociones;
2. conservar `request_id`, hora e impacto;
3. restaurar el último despliegue estable de Vercel;
4. verificar `/api/health`;
5. preparar la corrección en un commit nuevo.

### Base de datos

Si el incidente fue introducido por una migración:

1. detener escrituras afectadas;
2. no editar ni eliminar la migración aplicada;
3. preparar una migración correctiva;
4. usar restauración desde respaldo únicamente cuando el impacto lo exija y exista autorización;
5. probar primero la restauración en un entorno aislado.

## Restauración

La ejecución detallada y sus criterios de aceptación se mantienen en [Operación y recuperación](../OPERACION_Y_RECUPERACION.md). La prueba debe incluir base de datos, Storage, migraciones posteriores, health check, vistas públicas, acceso administrativo, RLS/RPC e invariantes canónicas.

## Evidencia mínima

- commit y despliegue;
- migraciones aplicadas;
- entorno y responsable;
- resultado de CI;
- resultado de health check y `request_id`;
- E2E ejecutados y artefactos;
- punto de restauración o respaldo;
- incidencias, decisión de retroceso y resultado.

La ausencia de una prueba real de restauración, canal de incidentes o cuentas diferenciadas permanece como pendiente operativo de beta.

