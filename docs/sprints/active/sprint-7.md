# Sprint 7 — Portal administrativo y experiencia de usuario

> Estado: activo
> Inicio: 2026-07-16
> Actualizada: 2026-07-18
> Rama operativa: `main`
> Propietario: portal administrativo, diseño de interfaz y accesibilidad

## Objetivo

Consolidar el portal administrativo como una experiencia coherente, accesible, responsive y orientada al trabajo por rol, reutilizando los contratos funcionales estabilizados y sin duplicar lógica de negocio.

## Cola vigente

1. [x] S7-01 — Auditoría del plan UX, implementación y pendientes reales.
2. [x] S7-02 — Arquitectura de información y navegación por rol, permiso y alcance.
3. [x] S7-03 — Dashboard administrativo y acciones prioritarias.
4. [x] S7-04 — KPIs contextuales territoriales, pastorales, administrativos y colegiales.
5. [x] S7-05 — Encabezados, breadcrumbs, estados, feedback y jerarquía visual.
6. [x] S7-06 — Modo oscuro y tokens semánticos. **Validación técnica completada; revisión visual administrativa autenticada trasladada a S7-10.**
7. [x] S7-07 — Acceso flotante a herramientas de accesibilidad.
8. [x] S7-08 — Responsive, teclado, foco, contraste y lectores de pantalla.
9. [x] S7-09 — Consolidación de componentes, asistentes y capas heredadas.
10. [ ] S7-10 — Validación operativa, pruebas autenticadas y cierre.

## Estado resumido

### S7-01 — Completada

Se contrastó el plan UX con la implementación real y se establecieron las brechas de navegación, alcance, tema, accesibilidad, responsive y regresión visual.

### S7-02 — Completada con validación operativa diferida

Se definió la arquitectura canónica de navegación por permisos y alcance, incluida la matriz de disponibilidad y el selector de ámbito. La ejecución autenticada quedó trasladada a S7-10 porque el secreto `E2E_ACCESS_PROFILES_JSON` necesita reparación.

### S7-03 — Completada

El dashboard administrativo usa el contexto canónico de navegación, acciones filtradas por disponibilidad, alcance visible, búsqueda precisa y contratos de regresión.

### S7-04 — Completada con validación funcional diferida

Se implementaron KPIs contextuales y la RPC `public.get_admin_contextual_kpis(text, uuid)`. CI quedó en verde. La validación con un perfil restringido real se ejecutará en S7-10.

### S7-05 — Completada

Se normalizaron encabezados, breadcrumbs, estados de página, alertas, badges, botones, filtros y jerarquía en pantallas administrativas representativas. La duplicación transversal restante se resolvió en S7-09.

### S7-06 — Completada técnicamente

Se implementaron:

- apariencia clara, oscura y automática;
- persistencia y aplicación previa a hidratación;
- tokens semánticos para superficies, texto, bordes, foco y estados;
- cobertura pública y administrativa;
- contratos de tema y E2E público.

La inspección visual administrativa autenticada en ambos temas queda como criterio de S7-10.

### S7-07 — Completada

El acceso flotante a herramientas de accesibilidad quedó integrado y protegido por contratos, compatible con escritorio y móvil.

### S7-08 — Completada

Se consolidaron responsive, navegación por teclado, foco visible, contraste, regiones vivas y semántica de formularios y diálogos. Los hallazgos estructurales restantes se trataron en S7-09.

### S7-09 — Completada

Se consolidaron eventos, configuración estructural, asistentes de clero, persona laica y vida consagrada. Se retiraron hojas específicas, CSS embebido y `AutoSectionWizard`. `LegacyAdminAccessibilityEnhancements` quedó limitado a formularios heredados todavía no migrados y al diálogo móvil global.

El detalle de los 18 bloques se mantiene en `docs/sprints/active/sprint-7-s7-09.md`.

## S7-10 — Alcance de cierre

S7-10 debe cerrar conjuntamente validación, operación y evidencia:

1. Reparar `E2E_ACCESS_PROFILES_JSON` y ejecutar la matriz autenticada.
2. Demostrar aislamiento bidireccional entre dos diócesis.
3. Validar KPIs contextuales con un perfil restringido real.
4. Ejecutar revisión visual administrativa en modo claro y oscuro.
5. Ejecutar accesibilidad autenticada sobre los flujos críticos.
6. Activar protección contra contraseñas filtradas en Supabase Auth.
7. Ejecutar `pnpm check`, workflows aplicables y CodeQL.
8. Conservar evidencia operativa sin secretos.
9. Reconciliar documentación final y cerrar Sprint 7.

## Deuda posterior controlada

No bloquea S7-10 salvo que una prueba demuestre una regresión:

- migrar formularios administrativos heredados restantes;
- trasladar la gestión de foco del menú móvil hacia `AdminShell` o un diálogo reutilizable;
- retirar completamente `LegacyAdminAccessibilityEnhancements` cuando quede sin consumidores.

## Reglas del sprint

- La UI no accede directamente a datos cuando existe un servicio de dominio.
- Navegación y acciones respetan permisos y alcance.
- Todos los cambios funcionan en modo claro y oscuro.
- Teclado, foco, contraste y etiquetas accesibles son obligatorios.
- No se introducen componentes duplicados para variantes componibles.
- Las rutas administrativas delegan en sus features.
- Las evidencias de validación no exponen credenciales ni secretos.

## Criterios de cierre

- El portal administrativo presenta una estructura coherente y predecible.
- Cada rol ve acciones, alertas y KPIs relevantes para su alcance.
- Los flujos críticos funcionan en escritorio, tableta y móvil.
- Tema y accesibilidad están cubiertos por contratos y pruebas autenticadas.
- No se introducen accesos directos a datos ni duplicación de lógica de negocio.
- CI valida documentación, TypeScript, pruebas, build y seguridad.
- Las deudas operativas de acceso, aislamiento, KPIs y contraseñas quedan cerradas con evidencia.

## Punto de continuación

Iniciar S7-10 por la reparación del perfil E2E autenticado. Después ejecutar la matriz de acceso, aislamiento entre diócesis, KPIs restringidos, revisión visual claro/oscuro, accesibilidad y cierre documental del Sprint 7.
