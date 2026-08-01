# S7-10 — Evidencia operativa y bloqueo final de cierre

> Estado: cierre técnico completado; decisión de riesgo pendiente
> Actualizada: 2026-08-01
> Rama operativa: `main`
> Alcance: validación operativa, pruebas autenticadas y cierre de Sprint 7

## Evidencia confirmada

### 1. Aprovisionamiento QA protegido

- Workflow canónico: `.github/workflows/e2e-provision-access.yml`.
- Ejecución manual protegida mediante la confirmación `PROVISION_NON_PRODUCTION_E2E`.
- Uso del entorno protegido `qa` y de `SUPABASE_SERVICE_ROLE_KEY`.
- Creación o actualización idempotente de cinco perfiles técnicos.
- Generación de `E2E_ACCESS_PROFILES_JSON` como artefacto temporal con retención de un día.
- Las credenciales no se incorporan al repositorio.

### 2. Matriz administrativa autenticada

- Workflow canónico: `.github/workflows/e2e-admin-access.yml`.
- Ejecución independiente aprobada sobre `main` después de alinear el servidor con el flujo de aprovisionamiento.
- La aplicación se compila mediante `pnpm build` y se ejecuta con `pnpm start`.
- Playwright reutiliza el servidor mediante `E2E_BASE_URL`.
- Se validaron cinco estados operativos:
  - administrador con alcance territorial;
  - consulta interna con alcance territorial;
  - onboarding pendiente;
  - usuario sin rol administrativo;
  - acceso suspendido.
- Se validó aislamiento territorial entre la Arquidiócesis del Ozama y la Diócesis de Monte Azul.
- Última evidencia confirmada: `E2E / Admin access matrix #45` en verde sobre `main`.

### 3. KPIs contextuales restringidos

- La matriz autenticada valida el dashboard con perfiles territoriales reales.
- El administrador de la Arquidiócesis del Ozama y el perfil de consulta de la Diócesis de Monte Azul reciben su alcance esperado.
- La fuente global permanece bloqueada para perfiles restringidos.
- Los indicadores contextuales cargan valores numéricos dentro del alcance autorizado.
- La prueba conserva el aislamiento entre la entidad propia y la entidad prohibida.

### 4. Evidencia visual administrativa autenticada

- Se validó el dashboard administrativo con sesión real.
- Se generaron capturas en modo claro y oscuro.
- Se cubrieron móvil, tableta y escritorio.
- Se comprobó ausencia de desbordamiento horizontal global.
- Las capturas se conservan como artefactos del workflow administrativo.

### 5. Accesibilidad administrativa autenticada

- Se ejecutó Axe sobre los perfiles operativos de administración y consulta.
- No quedaron violaciones automáticas críticas o serias.
- Se validó un único `h1` y texto alternativo en imágenes.
- Se validó navegación inicial por teclado.
- El menú móvil:
  - abre mediante teclado;
  - mueve el foco al diálogo;
  - cierra con `Escape`;
  - devuelve el foco al botón `Más`.
- Se corrigieron contrastes en notas KPI, navegación móvil, badges institucionales y estados vacíos.
- Las regiones horizontales de tablas son enfocables y tienen nombre accesible.

### 6. CI, compilación y accesibilidad pública

- CI general aprobado en `main` después de las correcciones de tipado, contratos y workflows.
- `pnpm check` cubre documentación, auditorías, TypeScript, pruebas, build y presupuesto de bundles.
- `E2E / Public accessibility` aprobado en `main`.
- La evidencia visual de la portada pública conserva capturas completas como artefactos sin comparar píxel a píxel contenido dinámico de altura variable.
- Las superficies estáticas de autenticación mantienen baselines visuales estrictos.

### 7. Seguridad de código y dependencias

- Alerta CodeQL `Incomplete string escaping or encoding` corregida mediante escape completo de metacaracteres de expresiones regulares.
- `sharp` quedó fijado y resuelto en `0.35.3`.
- El override se mantiene en `pnpm-workspace.yaml`, conforme al contrato de despliegue.
- `pnpm-lock.yaml` fue regenerado y validado mediante una ejecución manual protegida de CI.
- La alerta Dependabot heredada de `libvips` quedó cerrada automáticamente.

### 8. Desaprovisionamiento seguro de cuentas QA

- Workflow canónico: `.github/workflows/e2e-deprovision-access.yml`.
- Ejecución manual protegida mediante la confirmación `DEPROVISION_NON_PRODUCTION_E2E`.
- El workflow fija `E2E_DEPROVISION_MODE=suspend` y no expone eliminación de usuarios.
- Solo procesa cuentas marcadas con `app_metadata.e2e_access_profile=true` y dominio `example.test`.
- Suspende los perfiles, retira todas las asignaciones de rol y registra auditoría.
- Verifica después que los perfiles estén suspendidos y sin roles.
- Ejecución confirmada: `E2E / Suspend QA access profiles #1` en verde sobre `b304a7d`.
- Las cuentas permanecen en Supabase Auth para permitir reactivación controlada mediante el aprovisionador con contraseñas nuevas.

## Correcciones relevantes incorporadas

- Restauración de privilegios mínimos de `service_role` para el aprovisionamiento QA.
- Inclusión de arquidiócesis y demás jurisdicciones equivalentes en el endpoint administrativo de alcance.
- Corrección del doble arranque del servidor Playwright.
- Alineación del workflow independiente de acceso con el servidor de producción local usado por el flujo exitoso.
- Corrección del tipado Supabase en `dioceses-filtered`.
- Actualización del inventario contractual de workflows.
- Estabilización de evidencia visual pública dinámica.
- Corrección de escape incompleto detectado por CodeQL.
- Actualización controlada de `sharp` y sus binarios nativos.
- Validación E2E de KPIs restringidos.
- Evidencia visual administrativa autenticada.
- Correcciones de contraste, teclado, foco y regiones desplazables.
- Workflow reversible y auditable para suspender perfiles QA.

## Control manual pendiente

### Retirar el secreto de credenciales E2E

Después de la suspensión, el secreto `E2E_ACCESS_PROFILES_JSON` ya no debe conservarse. Debe eliminarse del entorno `qa` o de los secretos del repositorio, según dónde esté configurado.

Cuando se necesite una nueva ronda autenticada:

1. ejecutar `E2E / Provision QA access profiles`;
2. descargar el artefacto recién generado;
3. registrar temporalmente `E2E_ACCESS_PROFILES_JSON`;
4. ejecutar las pruebas;
5. suspender las cuentas;
6. eliminar nuevamente el secreto.

## Único bloqueo restante para cerrar Sprint 7

### Protección frente a contraseñas filtradas

- El plan Free de Supabase no ofrece esta función.
- Debe elegirse una de estas opciones:
  1. actualizar el plan de Supabase y activar la protección;
  2. aceptar temporalmente el riesgo, indicando responsable y fecha de revisión.

Hasta que exista esa decisión explícita, S7-10 queda técnicamente completada, pero Sprint 7 no debe marcarse como cerrado.

## Orden vigente de cierre

1. Eliminar el secreto `E2E_ACCESS_PROFILES_JSON`.
2. Resolver o aceptar formalmente el riesgo de contraseñas filtradas.
3. Ejecutar CI aplicable sobre el commit documental final.
4. Actualizar `sprint-7.md` a estado completado.
5. Mover la evidencia a documentación histórica.

## Criterio de decisión

La matriz de acceso, los KPIs restringidos, la evidencia visual, la accesibilidad autenticada, la seguridad técnica y el desaprovisionamiento ya están completos. El único bloqueo restante es una decisión explícita de seguridad y gobernanza sobre la protección frente a contraseñas filtradas.