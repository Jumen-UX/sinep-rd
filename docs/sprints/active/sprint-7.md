# Sprint 7 — Portal administrativo y experiencia de usuario

> Estado: activo
> Inicio: 2026-07-16
> Rama operativa: `main`
> Propietario: portal administrativo, diseño de interfaz y accesibilidad

## Objetivo

Consolidar el portal administrativo como una experiencia coherente, accesible, responsive y orientada al trabajo por rol, reutilizando los contratos funcionales ya estabilizados y sin duplicar lógica de negocio.

## Cola inicial

1. [x] S7-01 — Auditar el plan UX vigente, la implementación actual y los pendientes reales antes de modificar pantallas.
2. [ ] S7-02 — Definir la arquitectura de información y navegación administrativa por rol, permiso y alcance. **En progreso:** contrato definido; implementación y pruebas pendientes.
3. [ ] S7-03 — Consolidar el dashboard administrativo y sus acciones prioritarias.
4. [ ] S7-04 — Integrar KPIs contextuales por dimensión territorial, pastoral, administrativa y colegial.
5. [ ] S7-05 — Normalizar encabezados, breadcrumbs, estados vacíos, feedback y jerarquía visual.
6. [ ] S7-06 — Completar modo oscuro sobre todos los componentes administrativos.
7. [ ] S7-07 — Implementar y validar el acceso flotante a herramientas de accesibilidad.
8. [ ] S7-08 — Revisar responsive, teclado, foco, contraste y lectores de pantalla.
9. [ ] S7-09 — Reducir duplicación visual y consolidar componentes reutilizables.
10. [ ] S7-10 — Ejecutar pruebas visuales, accesibilidad, `pnpm check`, CI y cierre.

## Estado de ejecución

### S7-01 — Completada

Se contrastó el plan UX vigente con la implementación actual. El levantamiento identificó fundamentos existentes y brechas en navegación por permisos, alcance visible, modo oscuro, accesibilidad, búsqueda, navegación móvil y regresión visual.

### S7-02 — En progreso

Se creó `docs/product/ADMIN_NAVIGATION_ARCHITECTURE.md` como contrato canónico para:

- navegación por permiso y alcance;
- estados `available`, `read_only`, `blocked` y `hidden`;
- registro único de rutas;
- selector de alcance;
- navegación móvil priorizada;
- integración del dashboard;
- responsabilidades técnicas y pruebas obligatorias.

La siguiente actividad es implementar el contrato con políticas puras, servicio de contexto, proveedor compartido y sustitución de las listas estáticas de `AdminShell`.

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

Continuar S7-02 implementando `admin-navigation-contract.ts`, `admin-navigation-policy.ts` y sus pruebas unitarias antes de conectar el contexto de Supabase o modificar `AdminShell`.
