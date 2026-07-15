# Sprint 4 — Personas, cargos y nombramientos

> Estado: activo
> Inicio: 2026-07-15
> Rama operativa: `main`
> Propietario: dominios de personas, clero y nombramientos

## Objetivo

Unificar los historiales personales y ministeriales para que una persona conserve una identidad única durante toda su trayectoria eclesial y los cargos respeten nivel, vigencia, sucesión, fuente y verificación.

## Cola de ejecución

1. [x] S4-01 — Auditar los flujos actuales y definir el contrato del asistente común.
2. [x] S4-02 — Implementar detección de duplicados y resolución explícita de identidad.
3. [ ] S4-03 — Aplicar el asistente común a obispos, sacerdotes, diáconos, religiosos y laicos. **En progreso:** componente común creado; asistente de diácono migrado y protegido por prueba contractual.
4. [ ] S4-04 — Garantizar continuidad diácono → sacerdote → obispo sobre un único `person_id`.
5. [ ] S4-05 — Unificar sacerdotes diocesanos y religiosos sin duplicar personas.
6. [ ] S4-06 — Aplicar cargos compatibles con el nivel estructural seleccionado.
7. [ ] S4-07 — Consolidar vacantes, sustituciones, renovaciones y suspensiones.
8. [ ] S4-08 — Mostrar sucesión e impacto antes de guardar nombramientos.
9. [ ] S4-09 — Incorporar fuente y estado de verificación en los flujos unificados.
10. [ ] S4-10 — Corregir y validar clérigos sin perfil canónico.
11. [ ] S4-11 — Ejecutar `pnpm check`, pruebas funcionales y verificación del entorno desplegado.

## Estado técnico

S4-01 y S4-02 están completados. La búsqueda autenticada se expone mediante `findPotentialDuplicates`; el servicio de resolución de identidad exige una decisión explícita `reuse` o `create_new`; una reutilización solo acepta identificadores presentes entre las coincidencias revisadas; y el contrato está protegido por pruebas.

S4-03 utiliza `PersonIdentityStep` como componente compartido para normalizar la decisión entre reutilizar una persona existente o crear una identidad nueva. El componente conserva semántica accesible, limpia la selección al cambiar a identidad nueva y queda protegido por una prueba contractual.

El asistente de diácono ya consume este componente sin modificar las reglas existentes de `mode`, `selected_person_id`, validación de identidad ni persistencia canónica. Una prueba específica protege esa integración. Los siguientes flujos a migrar son sacerdote, obispo, vida consagrada y laico.

Los asistentes no migrados conservan temporalmente compatibilidad heredada hasta completar S4-03.

## Criterios de cierre

- Una persona conserva un único ID durante toda su historia.
- Ningún cargo actual incompatible o equivalente puede duplicarse silenciosamente.
- Toda sustitución conserva predecesor y sucesor.
- Los cargos incompatibles se bloquean o requieren confirmación explícita según contrato.
- Las operaciones críticas conservan validación, permiso, alcance, transacción, auditoría y prueba.

## Dependencia operativa heredada

S3-06 permanece abierto hasta disponer de una URL autorizada y cuentas diferenciadas para ejecutar la matriz E2E autenticada. Este bloqueo es operativo y no impide continuar Sprint 4.

Consulta [la auditoría de flujos de personas](./sprint-4-person-flows-audit.md).
