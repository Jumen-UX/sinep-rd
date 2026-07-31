# S7-10 — Evidencia operativa y bloqueos de cierre

> Estado: en progreso avanzado
> Actualizada: 2026-07-31
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

### 3. CI y compilación

- CI general aprobado en `main` después de las correcciones de tipado, contratos y workflows.
- `pnpm check` cubre documentación, auditorías, TypeScript, pruebas, build y presupuesto de bundles.
- El contrato canónico de workflows reconoce:
  - CI;
  - accesibilidad pública;
  - matriz administrativa;
  - aprovisionamiento QA protegido.

### 4. Accesibilidad y evidencia visual pública

- `E2E / Public accessibility` aprobado en `main`.
- La evidencia visual de la portada pública conserva capturas completas como artefactos sin comparar píxel a píxel contenido dinámico de altura variable.
- Las superficies estáticas de autenticación mantienen baselines visuales estrictos.
- Se mantienen comprobaciones de tema, visibilidad, ausencia de desbordamiento horizontal y posición segura del control de accesibilidad móvil.

### 5. Seguridad de código y dependencias

- Alerta CodeQL `Incomplete string escaping or encoding` corregida mediante escape completo de metacaracteres de expresiones regulares.
- `sharp` quedó fijado y resuelto en `0.35.3`.
- El override se mantiene en `pnpm-workspace.yaml`, conforme al contrato de despliegue.
- `pnpm-lock.yaml` fue regenerado y validado mediante una ejecución manual protegida de CI.
- La alerta Dependabot heredada de `libvips` quedó cerrada automáticamente.

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

## Bloqueos restantes para cerrar S7-10

S7-10 no debe marcarse como completada hasta resolver los siguientes criterios ya definidos en `sprint-7.md`:

1. **KPIs contextuales con perfil restringido real**
   - Falta una prueba autenticada que confirme que los indicadores respetan el alcance territorial del usuario.

2. **Revisión visual administrativa autenticada**
   - Falta evidencia de superficies administrativas reales en modo claro y oscuro.

3. **Accesibilidad autenticada**
   - Falta ejecutar Axe y navegación por teclado sobre flujos administrativos críticos con sesión activa.

4. **Desaprovisionamiento de cuentas QA**
   - Falta ejecutar `pnpm e2e:access:deprovision` para suspender las cuentas técnicas después de la ronda.

5. **Protección frente a contraseñas filtradas**
   - El plan Free de Supabase no ofrece la función.
   - Debe actualizarse el plan y activarla, o registrarse una aceptación temporal del riesgo con responsable y fecha de revisión.

## Orden vigente de cierre

1. Añadir prueba E2E de KPIs restringidos.
2. Añadir evidencia visual administrativa autenticada en claro y oscuro.
3. Añadir accesibilidad autenticada con Axe y teclado.
4. Ejecutar y evidenciar el desaprovisionamiento seguro.
5. Resolver o aceptar formalmente el riesgo de contraseñas filtradas.
6. Ejecutar CI, CodeQL y workflows aplicables sobre el commit candidato.
7. Actualizar `sprint-7.md` a estado completado y mover la evidencia a documentación histórica.

## Criterio de decisión

La matriz de acceso y la seguridad técnica ya están operativas. El sprint permanece abierto exclusivamente por los criterios funcionales y operativos anteriores; no por fallos actuales de autenticación, compilación o dependencias.
