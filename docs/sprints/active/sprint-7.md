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
4. [x] S7-04 — Integrar KPIs contextuales por dimensión territorial, pastoral, administrativa y colegial. **Implementación, migración y CI completados; validación manual con un perfil restringido registrada como deuda funcional.**
5. [ ] S7-05 — Normalizar encabezados, breadcrumbs, estados vacíos, feedback y jerarquía visual. **En progreso; dos bloques confirmados con CI verde.**
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

### S7-04 — Completada con validación manual diferida

Se implementaron el contrato, política y adaptador de KPIs contextuales, la agrupación visual por dimensión, el bloqueo de fuentes globales para alcances restringidos y la RPC `public.get_admin_contextual_kpis(text, uuid)`. La migración fue aplicada correctamente en Supabase y CI confirmó documentación, TypeScript, pruebas y build en verde.

Queda registrada como deuda funcional la validación manual con un perfil restringido real para confirmar que las políticas RLS permiten leer todos los descendientes autorizados sin producir conteos parciales.

### S7-05 — En progreso

La auditoría inicial confirmó que conviven componentes compartidos modernos con clases heredadas como `page-heading`, `empty-state`, `error-box`, `admin-topbar` y botones definidos únicamente por clases CSS.

Se implementaron:

- `src/components/ui/page-state.tsx`, que normaliza estados de carga, error y vacío con semántica accesible;
- migración de `RequestsPage.tsx` a `PageHeader`, breadcrumbs canónicos, `PageState`, `StatusBadge` y `Button`;
- jerarquía de encabezados `h1 → h2 → h3` en la bandeja de solicitudes;
- contadores y estados visuales consistentes para solicitudes públicas e internas;
- migración de `AdministrativeActivityPage.tsx` al mismo contrato compartido;
- estados de carga, error y vacío accesibles en la actividad administrativa;
- breadcrumbs completos `Administración → Configuración → Actividad` y jerarquía `h1 → h2 → h3`;
- ampliación de `tests/admin-page-state-hierarchy.test.mjs` para proteger ambas pantallas y evitar el retorno de clases heredadas.

El primer y segundo bloque fueron confirmados con CI verde el 2026-07-17. La siguiente iteración continuará con una tercera pantalla administrativa que conserve estados o encabezados heredados.

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

Continuar con una tercera pantalla administrativa que conserve estados o encabezados heredados, priorizando una vista con carga, error y vacío propios. La deuda de validación funcional de KPIs restringidos y la matriz E2E autenticada deberán retomarse antes del cierre S7-10 o cuando existan perfiles de prueba estables.
