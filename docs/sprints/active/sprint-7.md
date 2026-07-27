# Sprint 7 — Portal administrativo y experiencia de usuario

> Estado: en progreso
> Inicio: 2026-07-16
> Actualizada: 2026-07-27
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
10. [ ] S7-10 — Validación operativa, pruebas autenticadas y cierre. **Reactivada el 2026-07-27; aprovisionamiento técnico preparado, ejecución protegida pendiente.**

## Estado resumido

### S7-01 — Completada

Se contrastó el plan UX con la implementación real y se establecieron las brechas de navegación, alcance, tema, accesibilidad, responsive y regresión visual.

### S7-02 — Completada con validación operativa diferida

Se definió la arquitectura canónica de navegación por permisos y alcance, incluida la matriz de disponibilidad y el selector de ámbito. El contrato protegido de `E2E_ACCESS_PROFILES_JSON` y el ciclo de vida de sus cuentas técnicas están versionados; la ejecución autenticada continúa en S7-10 porque requiere `service_role` y escritura manual del secreto de GitHub Actions.

### S7-03 — Completada

El dashboard administrativo usa el contexto canónico de navegación, acciones filtradas por disponibilidad, alcance visible, búsqueda precisa y contratos de regresión.

### S7-04 — Completada con validación funcional diferida

Se implementaron KPIs contextuales y la RPC `public.get_admin_contextual_kpis(text, uuid)`. La validación con un perfil restringido real se ejecutará en S7-10.

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

## S7-10 — Alcance de cierre reactivado

S7-10 debe cerrar conjuntamente validación, operación y evidencia:

1. Ejecutar `pnpm e2e:access:provision` con la confirmación QA y la clave protegida `service_role`.
2. Guardar el JSON generado como secreto `E2E_ACCESS_PROFILES_JSON` sin incorporarlo al repositorio.
3. Ejecutar la matriz autenticada y demostrar aislamiento bidireccional entre dos diócesis.
4. Validar KPIs contextuales con un perfil restringido real.
5. Ejecutar revisión visual administrativa en modo claro y oscuro.
6. Ejecutar accesibilidad autenticada sobre los flujos críticos.
7. Suspender las cuentas técnicas después de la ronda mediante `pnpm e2e:access:deprovision`.
8. Resolver el control de contraseñas filtradas: actualizar Supabase a Pro o superior y activarlo, o registrar formalmente la aceptación temporal del riesgo. El plan Free actual no ofrece esta función.
9. Ejecutar `pnpm check`, workflows aplicables y CodeQL sobre el commit candidato.
10. Conservar evidencia operativa sin secretos, reconciliar documentación final y cerrar Sprint 7.

### Avance de reactivación — 2026-07-27

- Se retiraron los renderizadores públicos heredados que interpolaban contenido mediante `innerHTML`, `MutationObserver` y temporizadores.
- El alcance territorial multi-país quedó integrado en el modelo React tipado y se añadió una prueba que prohíbe sumideros HTML crudos en `src/features/public`.
- Se corrigió el reporte final de importaciones para leer `reversal_plan`, que es el campo canónico existente.
- Se añadió y aplicó la política RLS `import_batch_reversals_select_scoped`; las escrituras permanecen exclusivamente detrás de la RPC auditada.
- El advisor de seguridad de Supabase ya no reporta la tabla de reversiones. Permanece únicamente la advertencia de contraseñas filtradas, bloqueada por el plan Free.
- Se centralizó la validación de `E2E_ACCESS_PROFILES_JSON`: exige cuatro estados, roles de navegación administrador/consulta y aislamiento A↔B.
- `scripts/provision-e2e-access-profiles.mjs` crea o actualiza cinco cuentas técnicas mediante la API oficial de Supabase Auth, rota contraseñas, configura perfiles y roles, audita y genera el secreto con permisos `0600`.
- `scripts/deprovision-e2e-access-profiles.mjs` suspende perfiles y retira roles de forma predeterminada; la eliminación física requiere una segunda confirmación explícita.
- `.secrets/` está excluido de Git y los contratos prohíben imprimir o persistir contraseñas en auditoría.
- Los cambios técnicos de aprovisionamiento compilaron en Vercel. La ejecución real sobre Auth, la escritura del secreto y la matriz Playwright siguen pendientes porque requieren credenciales operativas no disponibles en los conectores.
- La ejecución completa de GitHub CI, CodeQL y E2E autenticado sigue pendiente; un build Vercel correcto no sustituye esas evidencias.

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
- Las deudas operativas de acceso, aislamiento y KPIs quedan cerradas con evidencia.
- La protección frente a contraseñas filtradas queda activada o documentada como riesgo temporal aceptado con responsable y fecha de revisión.

## Punto de continuación

Ejecutar el aprovisionador con `service_role`, guardar `E2E_ACCESS_PROFILES_JSON`, correr la matriz de acceso y conservar la evidencia A↔B. Después validar KPIs restringidos, revisión visual claro/oscuro, accesibilidad, CI/CodeQL y suspender las cuentas técnicas. La decisión de plan Supabase debe resolverse antes del cierre final o quedar aceptada formalmente como riesgo temporal.
