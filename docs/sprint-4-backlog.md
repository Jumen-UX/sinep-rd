# Sprint 4 — Personas, cargos y nombramientos

Estado: iniciado
Fecha de inicio: 2026-07-15
Rama operativa: main

## Objetivo

Unificar los historiales personales y ministeriales para que una persona conserve una identidad única durante toda su trayectoria eclesial y los cargos respeten nivel, vigencia, sucesión, fuente y verificación.

## Cola de ejecución

1. S4-01 — Auditar los flujos actuales de creación de personas y definir el contrato del asistente común.
2. S4-02 — Implementar detección de duplicados antes de crear una persona.
3. S4-03 — Aplicar el asistente común a obispos, sacerdotes, diáconos, religiosos y laicos.
4. S4-04 — Garantizar continuidad diácono → sacerdote → obispo sobre un único person_id.
5. S4-05 — Unificar sacerdotes diocesanos y religiosos sin duplicar personas.
6. S4-06 — Aplicar cargos compatibles con el nivel estructural seleccionado.
7. S4-07 — Consolidar vacantes, sustituciones, renovaciones y suspensiones.
8. S4-08 — Mostrar sucesión e impacto antes de guardar nombramientos.
9. S4-09 — Incorporar fuente y estado de verificación en los flujos unificados.
10. S4-10 — Corregir y validar los clérigos sin perfil canónico.
11. S4-11 — Ejecutar pnpm check, pruebas funcionales y verificación del entorno desplegado.

## Criterios de cierre

- Una persona conserva un único ID durante toda su historia.
- Ningún cargo actual incompatible o equivalente puede duplicarse silenciosamente.
- Toda sustitución conserva predecesor y sucesor.
- Los cargos incompatibles se bloquean o requieren confirmación explícita según contrato.
- Las operaciones críticas conservan validación, permiso, alcance, transacción, auditoría y prueba.

## Dependencia operativa heredada

S3-06 permanece abierto hasta disponer de URL pública y cuentas diferenciadas para ejecutar la matriz E2E autenticada. No bloquea este sprint.
