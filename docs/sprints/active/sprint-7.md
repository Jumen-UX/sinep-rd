# Sprint 7 — Portal administrativo y experiencia de usuario

> Estado: activo
> Inicio: 2026-07-16
> Actualizada: 2026-07-17
> Rama operativa: `main`
> Propietario: portal administrativo, diseño de interfaz y accesibilidad

## Objetivo

Consolidar el portal administrativo como una experiencia coherente, accesible, responsive y orientada al trabajo por rol, reutilizando los contratos funcionales ya estabilizados y sin duplicar lógica de negocio.

## Cola inicial

1. [x] S7-01 — Auditar el plan UX vigente, la implementación actual y los pendientes reales antes de modificar pantallas.
2. [x] S7-02 — Definir la arquitectura de información y navegación administrativa por rol, permiso y alcance. **Implementación y contratos completados; validación E2E autenticada diferida y registrada como deuda de validación.**
3. [x] S7-03 — Consolidar el dashboard administrativo y sus acciones prioritarias. **Completada y confirmada con CI verde.**
4. [x] S7-04 — Integrar KPIs contextuales por dimensión territorial, pastoral, administrativa y colegial. **Implementación, migración y CI completados; validación manual con un perfil restringido registrada como deuda funcional.**
5. [x] S7-05 — Normalizar encabezados, breadcrumbs, estados vacíos, feedback y jerarquía visual. **Completada con cuatro pantallas representativas y CI verde.**
6. [ ] S7-06 — Completar modo oscuro sobre todos los componentes administrativos. **Fundamentos, preferencia persistente y componentes compartidos completados; cobertura especializada en progreso.**
7. [ ] S7-07 — Implementar y validar el acceso flotante a herramientas de accesibilidad.
8. [ ] S7-08 — Revisar responsive, teclado, foco, contraste y lectores de pantalla.
9. [ ] S7-09 — Reducir duplicación visual y consolidar componentes reutilizables.
10. [ ] S7-10 — Ejecutar pruebas visuales, accesibilidad, `pnpm check`, CI y cierre.

## Estado de ejecución

### S7-01 — Completada

Se contrastó el plan UX vigente con la implementación actual. El levantamiento identificó fundamentos existentes y brechas en navegación por permisos, alcance visible, modo oscuro, accesibilidad, búsqueda, navegación móvil y regresión visual.

### S7-02 — Completada con validación diferida

Se creó `docs/product/ADMIN_NAVIGATION_ARCHITECTURE.md` como contrato canónico para navegación por permiso y alcance, estados de disponibilidad, registro único de rutas, selector de alcance, navegación móvil y responsabilidades técnicas.

La implementación quedó cubierta por TypeScript, pruebas unitarias y contractuales. La ejecución real de `E2E / Admin access matrix` quedó diferida porque el secreto protegido contenía JSON truncado. El workflow valida ahora el formato antes de preparar el navegador. La matriz deberá ejecutarse con perfiles estables antes de S7-10.

### S7-03 — Completada

Se consolidó el dashboard administrativo con el mismo contexto canónico de navegación, acceso a datos mediante servicio, acciones filtradas por disponibilidad, alcance activo visible, búsqueda precisa y pruebas contractuales. CI confirmó documentación, TypeScript, pruebas y build en verde.

### S7-04 — Completada con validación manual diferida

Se implementaron el contrato, política y adaptador de KPIs contextuales, la agrupación visual por dimensión, el bloqueo de fuentes globales para alcances restringidos y la RPC `public.get_admin_contextual_kpis(text, uuid)`. La migración fue aplicada correctamente en Supabase y CI confirmó documentación, TypeScript, pruebas y build en verde.

Queda registrada como deuda funcional la validación manual con un perfil restringido real para confirmar que las políticas RLS permiten leer todos los descendientes autorizados sin producir conteos parciales.

### S7-05 — Completada

La auditoría inicial confirmó que conviven componentes compartidos modernos con clases heredadas como `page-heading`, `empty-state`, `error-box`, `admin-topbar`, `admin-top-header` y botones definidos únicamente por clases CSS.

Se implementaron:

- `src/components/ui/page-state.tsx`, que normaliza estados de carga, error y vacío con semántica accesible;
- migración de `RequestsPage.tsx` a `PageHeader`, breadcrumbs canónicos, `PageState`, `StatusBadge` y `Button`;
- migración de `AdministrativeActivityPage.tsx` al mismo contrato compartido;
- migración de `PersonListPage.tsx`, eliminando su cabecera paralela y el panel de bienvenida duplicado;
- breadcrumbs `Administración → Personas`, badges de resumen, botones compartidos y estados de carga, error y vacío;
- filtros con `aria-pressed` y jerarquía `h1 → h2 → h3` en el directorio de personas;
- migración de `UserAccessPage.tsx` a `PageHeader`, breadcrumbs, `PageState`, `Alert`, `StatusBadge` y `Button`;
- corrección de la jerarquía de usuarios y roles para que las tarjetas usen `h3` bajo sus secciones `h2`;
- estados vacíos explícitos para catálogos de usuarios y roles;
- ampliación de `tests/admin-page-state-hierarchy.test.mjs` para proteger las cuatro pantallas y evitar el retorno de patrones heredados.

Los dos primeros bloques fueron confirmados con CI verde. El CI del tercer bloque detectó una regresión independiente en `package.json`: se habían perdido los scripts recientes de automatización documental, auditoría de migraciones y pruebas afectadas. El contrato completo fue restaurado sin modificar la funcionalidad de las pantallas.

La ejecución [CI #29551515252](https://github.com/Jumen-UX/sinep-rd/actions/runs/29551515252) confirmó en verde la cuarta migración: documentación, automatizaciones, TypeScript, 462 pruebas, build y CodeQL.

El inventario restante todavía contiene clases heredadas en asistentes y pantallas especializadas. No bloquea S7-05 porque la capa canónica, la semántica y el contrato de adopción ya quedaron demostrados en solicitudes, auditoría, personas y acceso. La eliminación transversal de duplicación visual continuará en S7-09, coordinada con modo oscuro y accesibilidad para evitar retrabajo.

### S7-06 — En progreso

El inventario inicial confirmó que el sistema solo declaraba `color-scheme: light`, no conservaba una preferencia de apariencia y mantenía colores claros fijos en superficies y estados compartidos.

El primer bloque implementó:

- preferencia `Claro`, `Oscuro` y `Automático`, persistida en `localStorage`;
- resolución de la preferencia del sistema mediante `prefers-color-scheme`;
- script `beforeInteractive` en el layout raíz para aplicar el tema antes del render y evitar destellos;
- control compartido disponible en el encabezado público y en la navegación administrativa;
- sincronización inmediata entre controles y reacción a cambios del sistema;
- tokens oscuros para superficies, texto, bordes, foco, sombras y estados semánticos;
- bordes semánticos temáticos en `Alert` y `StatusBadge`;
- sustitución de superficies claras fijas en el shell público y en los módulos administrativos compartidos;
- `tests/theme-contract.test.mjs`, que protege arranque, persistencia, opciones, exposición en ambos shells y uso de tokens semánticos.

La ejecución [CI #29552207127](https://github.com/Jumen-UX/sinep-rd/actions/runs/29552207127) confirmó documentación, auditorías, TypeScript, 465 pruebas, build y CodeQL. El primer intento detectó una expectativa heredada que exigía hexadecimales claros literales; el contrato fue actualizado para comprobar los tokens de contraste en ambos temas.

Este bloque establece la infraestructura canónica, pero no cierra S7-06. Permanecen colores fijos en estilos especializados del dashboard, navegación, asistentes, tablas, overlays y módulos históricos. Se migrarán por grupos visuales y se comprobarán en claro y oscuro antes de marcar la tarea como completada.

## Estado operativo separado

No bloquean el avance técnico de S7-05, pero deben cerrarse antes de S7-10:

- corregir el secreto `E2E_ACCESS_PROFILES_JSON` y ejecutar la matriz autenticada;
- demostrar aislamiento bidireccional entre dos diócesis;
- validar manualmente los KPIs contextuales con un perfil restringido;
- activar protección contra contraseñas filtradas en Supabase Auth;
- conservar evidencia sin secretos de las pruebas operativas.

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

Continuar S7-06 desde la infraestructura de tema ya implementada. El siguiente bloque debe migrar las superficies y estados fijos de `admin-dashboard.css`, `admin-dashboard-brand.css` y `admin-navigation.css`; después formularios, tablas, overlays y asistentes especializados. Las deudas operativas se mantienen separadas y deberán resolverse como parte de S7-10.
