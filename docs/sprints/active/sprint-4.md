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
3. [x] S4-03 — Aplicar el asistente común a obispos, sacerdotes, diáconos, religiosos y laicos.
4. [x] S4-04 — Garantizar continuidad diácono → sacerdote → obispo sobre un único `person_id`.
5. [x] S4-05 — Unificar sacerdotes diocesanos y religiosos sin duplicar personas.
6. [ ] S4-06 — Aplicar cargos compatibles con el nivel estructural seleccionado.
7. [ ] S4-07 — Consolidar vacantes, sustituciones, renovaciones y suspensiones.
8. [ ] S4-08 — Mostrar sucesión e impacto antes de guardar nombramientos.
9. [ ] S4-09 — Incorporar fuente y estado de verificación en los flujos unificados.
10. [ ] S4-10 — Corregir y validar clérigos sin perfil canónico.
11. [ ] S4-11 — Ejecutar `pnpm check`, pruebas funcionales y verificación del entorno desplegado.

## Estado técnico

S4-01 y S4-02 están completados. La búsqueda autenticada se expone mediante `findPotentialDuplicates`; el servicio de resolución de identidad exige una decisión explícita `reuse` o `create_new`; una reutilización solo acepta identificadores presentes entre las coincidencias revisadas; y el contrato está protegido por pruebas.

S4-03 utiliza `PersonIdentityStep` como componente compartido para normalizar la decisión entre reutilizar una persona existente o crear una identidad nueva. El componente conserva semántica accesible, limpia la selección al cambiar a identidad nueva y queda protegido por una prueba contractual.

Los asistentes de diácono, sacerdote, obispo, vida consagrada y laico ya consumen el componente común sin modificar sus contratos de persistencia. Sacerdote conserva la continuidad desde `existing_deacon_person_id`; obispo conserva `selected_clergy_id` y mantiene separados ordenación episcopal, función, estado, dignidades, nombramiento y fuente; vida consagrada conserva `selected_person_id`, profesión, pertenencia institucional, servicio y cargo sobre la misma identidad; laico conserva `selected_person_id`, datos privados y responsabilidad opcional sin convertir la condición laical en un tipo permanente. El caso de sacerdote religioso sigue delegado al flujo canónico de sacerdote para no duplicar presbiterado ni persona.

S4-04 queda protegido por `clerical-person-id-continuity.test.mjs`. Los adaptadores de sacerdote y obispo traducen sus identificadores heredados a `selected_person_id`; el motor bloquea transiciones sin el grado sacramental previo o con el grado destino ya registrado; reutiliza la fila bloqueada de `persons`; acumula diaconado, presbiterado y episcopado en `ordination_events`; actualiza un único `clergy_profiles`; y devuelve el mismo `person_id` como resultado canónico.

S4-05 queda protegido por `religious-priest-identity-unification.test.mjs`. Sacerdotes diocesanos y religiosos usan el mismo flujo `priest`; la variante religiosa exige instituto, congregación u orden; reutiliza el diácono seleccionado mediante `selected_person_id`; registra el presbiterado sobre la misma persona; actualiza un único `clergy_profiles`; crea o actualiza `religious_profiles` mediante conflicto por `person_id`; y deriva la incardinación como `religious_institute`. El asistente de vida consagrada delega cualquier sacerdote religioso al asistente sacerdotal canónico y no mantiene un escritor paralelo.

Cada integración tiene una prueba contractual específica. La validación conjunta de TypeScript, pruebas y build permanece en S4-11.

## Criterios de cierre

- Una persona conserva un único ID durante toda su historia.
- Ningún cargo actual incompatible o equivalente puede duplicarse silenciosamente.
- Toda sustitución conserva predecesor y sucesor.
- Los cargos incompatibles se bloquean o requieren confirmación explícita según contrato.
- Las operaciones críticas conservan validación, permiso, alcance, transacción, auditoría y prueba.

## Dependencia operativa heredada

S3-06 permanece abierto hasta disponer de una URL autorizada y cuentas diferenciadas para ejecutar la matriz E2E autenticada. Este bloqueo es operativo y no impide continuar Sprint 4.

Consulta [la auditoría de flujos de personas](./sprint-4-person-flows-audit.md).
