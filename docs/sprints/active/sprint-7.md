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
4. [ ] S7-04 — Integrar KPIs contextuales por dimensión territorial, pastoral, administrativa y colegial. **En progreso.**
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

La implementación quedó cubierta por TypeScript, pruebas unitarias y contractuales. La ejecución real de `E2E / Admin access matrix` se intentó con perfiles protegidos, pero quedó diferida por configuración inestable del secreto y credenciales de prueba. Esta deuda no elimina el workflow ni su contrato; deberá retomarse antes del cierre S7-10 o cuando existan perfiles E2E estables.

### S7-03 — Completada

Se consolidó el dashboard administrativo con el mismo contexto canónico de navegación:

- `src/features/admin/dashboard/admin-dashboard-service.ts` centraliza sesión, perfil, roles, resumen, conteos y actividad reciente;
- `AdminDashboardPage.tsx` dejó de consultar tablas directamente;
- acciones principales y frecuentes se muestran solo cuando el destino está `available`;
- métricas, revisión, actividad y búsqueda se muestran únicamente cuando el destino es visible para el usuario;
- el alcance activo se presenta en el encabezado y en el panel contextual;
- se retiró el breadcrumb duplicado de la barra superior;
- la búsqueda ahora declara con precisión que consulta personas y mantiene su destino real;
- perfiles de consulta reciben un estado explícito sin operaciones habilitadas;
- `tests/admin-dashboard-context.test.mjs` protege límites de servicio, contexto canónico, acciones y búsqueda.

El CI confirmó documentación, TypeScript, pruebas y build en verde. El filtrado de valores de KPI y datos por alcance activo se mantiene en S7-04 para no mezclar la política de acciones con la capa analítica contextual.

### S7-04 — En progreso

Se inicia el contrato de KPIs contextuales para que cada indicador declare dimensión, permiso de lectura, alcance aplicable, fuente de datos, estado de disponibilidad y destino navegable. La implementación deberá reutilizar el alcance activo de `AdminNavigationProvider`, evitar conteos globales para perfiles restringidos y separar los indicadores territoriales, pastorales, administrativos y colegiales.

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

Revisar las fuentes actuales de indicadores, el servicio del dashboard y los contratos territoriales, pastorales, administrativos y colegiales para definir una API contextual única. Después implementar filtros por alcance activo, estados de dato no disponible y pruebas que impidan mostrar cifras globales a perfiles restringidos.