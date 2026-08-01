# Sprint 7 — Portal administrativo y experiencia de usuario

> Estado: completado
> Inicio: 2026-07-16
> Cierre: 2026-07-31
> Rama operativa: `main`
> Propietario: portal administrativo, diseño de interfaz y accesibilidad

## Objetivo

Consolidar el portal administrativo como una experiencia coherente, accesible, responsive y orientada al trabajo por rol, reutilizando los contratos funcionales estabilizados y sin duplicar lógica de negocio.

## Resultado

1. [x] S7-01 — Auditoría del plan UX, implementación y pendientes reales.
2. [x] S7-02 — Arquitectura de información y navegación por rol, permiso y alcance.
3. [x] S7-03 — Dashboard administrativo y acciones prioritarias.
4. [x] S7-04 — KPIs contextuales territoriales, pastorales, administrativos y colegiales.
5. [x] S7-05 — Encabezados, breadcrumbs, estados, feedback y jerarquía visual.
6. [x] S7-06 — Modo oscuro y tokens semánticos.
7. [x] S7-07 — Acceso flotante a herramientas de accesibilidad.
8. [x] S7-08 — Responsive, teclado, foco, contraste y lectores de pantalla.
9. [x] S7-09 — Consolidación de componentes, asistentes y capas heredadas.
10. [x] S7-10 — Validación operativa, pruebas autenticadas y cierre.

## Capacidades consolidadas

- Navegación administrativa derivada de permisos, rol y alcance territorial.
- Selector de ámbito y visibilidad explícita del alcance activo.
- Dashboard con acciones y KPIs contextuales filtrados por autorización.
- Tema claro, oscuro y automático mediante tokens semánticos.
- Diseño responsive para escritorio, tableta y móvil.
- Accesibilidad con teclado, foco, contraste, semántica y Axe.
- Componentes administrativos reutilizables y reducción de capas heredadas.
- Búsqueda, estados, feedback, badges, filtros y jerarquía visual coherentes.

## Evidencia operativa S7-10

La evidencia detallada se mantiene en:

`docs/sprints/active/sprint-7-s7-10-evidence.md`

El cierre confirmó:

- aprovisionamiento QA protegido;
- cinco estados de acceso administrativo;
- aislamiento territorial entre Ozama y Monte Azul;
- KPIs contextuales con perfiles restringidos reales;
- evidencia visual autenticada en claro y oscuro, móvil, tableta y escritorio;
- accesibilidad administrativa autenticada sin violaciones críticas o serias;
- gestión de teclado, foco, `Escape` y retorno de foco en móvil;
- CI, build, accesibilidad pública, CodeQL y dependencias en estado válido;
- suspensión auditable de cuentas QA y retiro de roles.

## Riesgo temporal aceptado

El plan Free de Supabase no ofrece el control automático de protección frente a contraseñas filtradas. Se adoptó formalmente la opción A: mantener el plan durante la beta interna bajo controles compensatorios.

Registro canónico:

`docs/security/RISK_ACCEPTANCE_LEAKED_PASSWORD_PROTECTION.md`

La decisión debe revisarse antes del 2026-10-29 o antes de cualquier apertura pública, lo que ocurra primero.

## Deuda posterior controlada

No invalida el cierre del sprint:

- migrar formularios administrativos heredados restantes;
- retirar completamente `LegacyAdminAccessibilityEnhancements` cuando quede sin consumidores;
- revisar la actualización de Supabase antes del lanzamiento público;
- mantener el ciclo de aprovisionar, probar, suspender y eliminar credenciales temporales QA.

## Reglas preservadas

- La UI no accede directamente a datos cuando existe un servicio de dominio.
- Navegación, acciones y KPIs respetan permisos y alcance.
- Los cambios funcionan en modo claro y oscuro.
- Teclado, foco, contraste y etiquetas accesibles son obligatorios.
- No se introducen componentes duplicados para variantes componibles.
- Las evidencias no exponen credenciales ni secretos.

## Cierre

Sprint 7 queda completado con evidencia técnica y operativa. Los requisitos pendientes pertenecen a preparación de beta y lanzamiento público, no a la implementación del portal administrativo.