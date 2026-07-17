# Sprint 7 — Portal administrativo y experiencia de usuario

> Estado: activo
> Inicio: 2026-07-16
> Rama operativa: `main`
> Propietario: portal administrativo, diseño de interfaz y accesibilidad

## Objetivo

Consolidar el portal administrativo como una experiencia coherente, accesible, responsive y orientada al trabajo por rol, reutilizando los contratos funcionales ya estabilizados y sin duplicar lógica de negocio.

## Cola inicial

1. [x] S7-01 — Auditar el plan UX vigente, la implementación actual y los pendientes reales antes de modificar pantallas.
2. [x] S7-02 — Definir la arquitectura de información y navegación administrativa por rol, permiso y alcance. **Implementación y contratos completados; validación E2E autenticada diferida y registrada como deuda de validación.**
3. [x] S7-03 — Consolidar el dashboard administrativo y sus acciones prioritarias. **Completada y confirmada con CI verde.**
4. [ ] S7-04 — Integrar KPIs contextuales por dimensión territorial, pastoral, administrativa y colegial. **RPC restringida e integración implementadas; pendiente de aplicar migración y confirmar CI.**
5. [ ] S7-05 — Normalizar encabezados, breadcrumbs, estados vacíos, feedback y jerarquía visual.
6. [ ] S7-06 — Completar modo oscuro sobre todos los componentes administrativos.
7. [ ] S7-07 — Implementar y validar el acceso flotante a herramientas de accesibilidad.
8. [ ] S7-08 — Revisar responsive, teclado, foco, contraste y lectores de pantalla.
9. [ ] S7-09 — Reducir duplicación visual y consolidar componentes reutilizables.
10. [ ] S7-10 — Ejecutar pruebas visuales, accesibilidad, `pnpm check`, CI y cierre.

## Estado de ejecución

### S7-01 — Completada

Se contrastó el plan UX vigente con la implementación actual. El levantamiento identificó fundamentos existentes y brechas en navegación por permisos, alcance visible, modo oscuro, accesibilidad, búsqueda, navegación móvil y regresión visual.

### S7-02 — Completada con validación diferida

Se creó `docs/product/ADMIN_NAVIGATION_ARCHITECTURE.md` como contrato canónico para navegación por permiso y alcance, estados de disponibilidad, registro único de rutas, selector de alcance, navegación móvil y responsabilidades técnicas.

La implementación quedó cubierta por TypeScript, pruebas unitarias y contractuales. La ejecución real de `E2E / Admin access matrix` quedó diferida por configuración inestable del secreto y credenciales de prueba. Esta deuda no elimina el workflow ni su contrato; deberá retomarse antes del cierre S7-10 o cuando existan perfiles E2E estables.

### S7-03 — Completada

Se consolidó el dashboard administrativo con el mismo contexto canónico de navegación, acceso a datos mediante servicio, acciones filtradas por disponibilidad, alcance activo visible, búsqueda precisa y pruebas contractuales. CI confirmó documentación, TypeScript, pruebas y build en verde.

### S7-04 — En progreso

Se implementaron:

- `admin-kpi-contract.ts`, con doce indicadores distribuidos entre las dimensiones territorial, pastoral, administrativa y colegial;
- `admin-kpi-policy.ts`, con permisos, alcances y estados `available`, `not_applicable` y `hidden`;
- `admin-kpi-value-service.ts`, con estados de valor `available`, `unavailable` y `not_applicable`;
- agrupación visual de KPIs por dimensión en `AdminDashboardPage.tsx`;
- bloqueo de fuentes globales para alcances restringidos;
- `supabase/migrations/20260717013000_admin_contextual_kpis.sql`, que crea `public.get_admin_contextual_kpis(text, uuid)`;
- validación de sesión, tipo de alcance y pertenencia mediante `current_user_has_scope_for_entity`;
- expansión territorial exclusiva mediante `get_entity_descendants`;
- agregación inicial de entidades activas, parroquias activas, nombramientos activos y solicitudes pendientes;
- integración del alcance activo completo en `admin-dashboard-service.ts`;
- pruebas `admin-contextual-kpi-rpc.test.mjs`, `admin-kpi-policy.test.mjs` y `admin-dashboard-context.test.mjs`.

Los alcances `diocese`, `parish` y `entity` reciben valores contextuales para los cuatro indicadores soportados. Las dimensiones pastorales y colegiales permanecen explícitamente sin valor cuando no existe todavía una relación contextual canónica confirmada. No se utiliza ningún fallback global.

## Reglas del sprint

- Antes de rediseñar se debe revisar el plan UX ya existente y contrastarlo con el código actual.
- La UI no debe contener acceso directo a datos cuando exista un servicio de dominio.
- La navegación y las acciones visibles deben respetar permisos y alcance.
- Todos los cambios deben funcionar en modo claro y oscuro.
- Las mejoras deben mantener navegación por teclado, foco visible, contraste suficiente y etiquetas accesibles.
- No se deben introducir componentes duplicados para resolver variantes que puedan componerse desde una base común.
- Las rutas administrativas seguirán delegando en sus respectivas features.

## Criterios de cierre

- El portal administrativo presenta una estructura coherente y predecible.
- Cada rol ve acciones, alertas y KPIs relevantes para su alcance.
- Las pantallas principales funcionan correctamente en escritorio, tableta y móvil.
- Modo oscuro y accesibilidad quedan cubiertos por contratos y pruebas.
- No se introducen accesos directos a datos ni duplicación de lógica de negocio.
- CI valida documentación, TypeScript, pruebas y build.

## Punto de continuación

Aplicar la migración `20260717013000_admin_contextual_kpis.sql` en Supabase y ejecutar `pnpm check`. Con ambos resultados correctos, cerrar S7-04 e iniciar S7-05. Las métricas pastorales y colegiales ampliadas deberán incorporarse solo cuando sus relaciones canónicas estén documentadas y verificadas.
