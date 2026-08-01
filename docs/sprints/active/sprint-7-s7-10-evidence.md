# S7-10 — Evidencia operativa de cierre

> Estado: completado
> Actualizada: 2026-07-31
> Rama operativa: `main`
> Alcance: validación operativa, pruebas autenticadas y cierre de Sprint 7

## Evidencia confirmada

### Aprovisionamiento y matriz de acceso

- `.github/workflows/e2e-provision-access.yml` aprovisiona perfiles QA mediante confirmación explícita, entorno `qa` y `SUPABASE_SERVICE_ROLE_KEY`.
- Se generan cinco perfiles técnicos y un artefacto temporal con `E2E_ACCESS_PROFILES_JSON` sin incorporar credenciales al repositorio.
- `.github/workflows/e2e-admin-access.yml` valida cinco estados operativos: administrador, consulta interna, onboarding, usuario sin rol y acceso suspendido.
- Se demostró aislamiento territorial entre la Arquidiócesis del Ozama y la Diócesis de Monte Azul.
- Última evidencia autenticada confirmada: `E2E / Admin access matrix #45` en verde sobre `main`.

### KPIs contextuales restringidos

- El dashboard fue validado con perfiles territoriales reales.
- Cada perfil recibió su alcance esperado.
- La fuente global permaneció bloqueada para perfiles restringidos.
- Los KPIs contextuales cargaron valores numéricos dentro del alcance autorizado.
- La prueba conservó el aislamiento entre entidad propia y entidad prohibida.

### Evidencia visual administrativa

- Se validó el dashboard con sesión real.
- Se generaron capturas en modo claro y oscuro.
- Se cubrieron móvil, tableta y escritorio.
- Se comprobó ausencia de desbordamiento horizontal global.
- Las capturas permanecen como artefactos de GitHub Actions.

### Accesibilidad administrativa autenticada

- Axe se ejecutó sobre los perfiles de administración y consulta.
- No quedaron violaciones automáticas críticas o serias.
- Se validaron encabezado principal, texto alternativo, teclado y foco.
- El menú móvil abre mediante teclado, mueve el foco al diálogo, cierra con `Escape` y devuelve el foco al disparador.
- Se corrigieron contrastes, regiones desplazables, badges y estados vacíos.

### CI, seguridad y dependencias

- `pnpm check`, build, accesibilidad pública y workflows aplicables quedaron en verde.
- La alerta CodeQL por escape incompleto de expresiones regulares quedó corregida.
- `sharp` quedó fijado en `0.35.3` y la alerta Dependabot heredada de `libvips` se cerró.
- El inventario contractual reconoce los workflows canónicos de CI, accesibilidad pública, matriz administrativa, aprovisionamiento y suspensión QA.

### Desaprovisionamiento QA

- `.github/workflows/e2e-deprovision-access.yml` ejecuta únicamente el modo reversible `suspend`.
- Solo procesa cuentas marcadas como E2E con dominio `example.test`.
- Suspende perfiles, retira roles, registra auditoría y verifica el resultado.
- `E2E / Suspend QA access profiles #1` terminó en verde sobre `b304a7d`.
- Las cuentas permanecen en Supabase Auth para una futura reactivación controlada con contraseñas nuevas.

## Ciclo seguro de credenciales QA

Para cada nueva ronda autenticada:

1. ejecutar `E2E / Provision QA access profiles`;
2. descargar el artefacto recién generado;
3. registrar temporalmente `E2E_ACCESS_PROFILES_JSON`;
4. ejecutar la matriz y las pruebas autenticadas;
5. suspender las cuentas mediante el workflow de baja;
6. eliminar nuevamente `E2E_ACCESS_PROFILES_JSON`.

`SUPABASE_SERVICE_ROLE_KEY` no forma parte de este ciclo y debe mantenerse únicamente como secreto protegido del entorno QA.

## Decisión de riesgo sobre contraseñas filtradas

Se adoptó la opción A: mantener temporalmente Supabase Free durante la beta interna y aceptar formalmente el riesgo de no disponer del control automático de contraseñas filtradas.

La decisión, controles compensatorios, responsable y fecha máxima de revisión están registrados en:

`docs/security/RISK_ACCEPTANCE_LEAKED_PASSWORD_PROTECTION.md`

La revisión vence el 2026-10-29 o antes de cualquier apertura pública, lo que ocurra primero.

## Conclusión

S7-10 queda completada. La matriz de acceso, los KPIs restringidos, la evidencia visual, la accesibilidad autenticada, la seguridad técnica, el ciclo de credenciales y el desaprovisionamiento están documentados con evidencia. La protección frente a contraseñas filtradas permanece como riesgo temporal aceptado y requisito de revisión previa al lanzamiento público.