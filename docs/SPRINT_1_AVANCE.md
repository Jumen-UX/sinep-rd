# Sprint 1 — Arquitectura por dominios cerrada

Fecha de cierre: 14 de julio de 2026.

## Objetivo

Mantener las rutas de Next.js como puntos de entrada delgados y concentrar interfaz, acceso a datos y reglas de aplicación dentro de `src/features`.

## Resultado

Sprint 1 quedó cerrado con el inventario administrativo completo sin I/O directo en rutas:

- 55 rutas administrativas auditadas.
- 51 rutas delegan en features.
- 4 rutas son de composición legítima.
- 0 rutas contienen acceso directo a Supabase, RPC o `fetch`.
- TypeScript completó sin errores.
- 274 pruebas unitarias y contractuales aprobaron.
- El build de producción de Next.js 15.5.20 completó correctamente.
- Se generaron 50 páginas estáticas durante la compilación.

## Trabajo completado

- `/admin` delega en `features/admin/dashboard`.
- `/admin/personas` delega en `features/personas`.
- `/admin/asignaciones` delega en `features/appointments`.
- Los asistentes de obispo, sacerdote, diácono, religioso y laico delegan en sus dominios canónicos.
- `/admin/configuracion/cargos` delega en `features/appointments` y escribe mediante `admin_save_office_configuration`.
- `/admin/usuarios`, `/admin/usuarios/invitar`, `/admin/usuarios/recuperar` y `/admin/login` delegan en `features/access`.
- Login, redirección segura y recuperación de acceso quedaron detrás de `authentication-admin-service.ts`.
- `/admin/revision` delega en `features/review`.
- `/admin/estructura`, `/admin/estructura/cargos` y `/admin/organizacion` delegan en sus dominios canónicos.
- Las lecturas y escrituras de cargos por nivel quedaron encapsuladas en `level-office-admin-service.ts`.
- Todas las rutas operativas de eventos delegan en `features/events`: registro, asistente, cola, revisión, plan, contrato y verificación.
- Las rutas heredadas de `/admin/estructura/eventos` funcionan como alias del dominio canónico.
- `/admin/importar`, `/admin/importar/lotes` y `/admin/importar/[batchId]` delegan en `features/importaciones`.
- `/admin/solicitudes` y `/admin/solicitudes/[id]` delegan en `features/requests`.
- `/admin/nuevo/jurisdiccion`, `/admin/nuevo/parroquia` y `/admin/nuevo/capilla` delegan en `features/entities`.
- `/admin/alertas`, `/admin/alertas/jurisdicciones` y `/admin/estado-fichas` delegan en `features/data-quality`.
- `/admin/configuracion` delega en `features/configuration`.
- `/admin/actividad` delega en `features/audit`.
- `/admin/fallecimiento` delega en `features/person-status`.
- `/admin/organigramas` delega en `features/organization-charts`.
- `/admin/referencias-canonicas/cargos` delega en `features/canonical-references`.
- Las fronteras de ruta quedaron protegidas con pruebas contractuales para impedir la reintroducción de `createClient`, `.from()`, `.rpc()` o `fetch()` en `page.tsx`.

## Regla arquitectónica vigente

Las rutas bajo `src/app` pueden resolver parámetros y composición, pero no deben contener consultas de dominio, mutaciones directas ni reglas de negocio. Las operaciones críticas deben pasar por servicios de feature, endpoints validados o RPC auditadas.

## Validación de cierre

El comando `pnpm check` completó todas sus etapas:

1. Verificación de referencias legacy.
2. Auditoría de límites de rutas.
3. Typecheck.
4. Pruebas unitarias y contractuales.
5. Build de producción.

Resultado final del inventario:

```text
Rutas: 55 · feature: 51 · composición: 4 · I/O directo: 0
```

Resultado de pruebas:

```text
tests 274
pass 274
fail 0
```

## Deuda técnica trasladada al siguiente sprint

- Sustituir la actualización de cargos por nivel basada en borrado e inserción por una RPC transaccional y auditada.
- Unificar catálogos y persistencia repetida entre los asistentes de jurisdicción, parroquia y capilla.
- Revisar utilidades duplicadas de normalización, errores y alcance.
- Configurar caché de build para reducir tiempos de CI.
- Revisar las advertencias de serialización de cadenas grandes emitidas por Webpack.

## Criterio de cierre

Cumplido: las rutas administrativas delegan en features, no existe I/O directo en `page.tsx`, las fronteras están protegidas por pruebas automatizadas y el build de producción es exitoso.
