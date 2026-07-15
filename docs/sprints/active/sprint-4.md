# Sprint 4 — Personas, cargos y nombramientos

> Estado: completado
> Inicio: 2026-07-15
> Cierre técnico: 2026-07-15
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
6. [x] S4-06 — Aplicar cargos compatibles con el nivel estructural seleccionado.
7. [x] S4-07 — Consolidar vacantes, sustituciones, renovaciones y suspensiones.
8. [x] S4-08 — Mostrar sucesión e impacto antes de guardar nombramientos.
9. [x] S4-09 — Incorporar fuente y estado de verificación en los flujos unificados.
10. [x] S4-10 — Corregir y validar clérigos sin perfil canónico.
11. [x] S4-11 — Ejecutar `pnpm check`, validar Supabase y confirmar el diagnóstico canónico.

## Estado técnico

S4-01 y S4-02 están completados. La búsqueda autenticada se expone mediante `findPotentialDuplicates`; el servicio de resolución de identidad exige una decisión explícita `reuse` o `create_new`; una reutilización solo acepta identificadores presentes entre las coincidencias revisadas; y el contrato está protegido por pruebas.

S4-03 utiliza `PersonIdentityStep` como componente compartido para normalizar la decisión entre reutilizar una persona existente o crear una identidad nueva. El componente conserva semántica accesible, limpia la selección al cambiar a identidad nueva y queda protegido por una prueba contractual.

Los asistentes de diácono, sacerdote, obispo, vida consagrada y laico consumen el componente común sin modificar sus contratos de persistencia. Sacerdote conserva la continuidad desde `existing_deacon_person_id`; obispo conserva `selected_clergy_id` y mantiene separados ordenación episcopal, función, estado, dignidades, nombramiento y fuente; vida consagrada conserva `selected_person_id`, profesión, pertenencia institucional, servicio y cargo sobre la misma identidad; laico conserva `selected_person_id`, datos privados y responsabilidad opcional sin convertir la condición laical en un tipo permanente. El caso de sacerdote religioso sigue delegado al flujo canónico de sacerdote para no duplicar presbiterado ni persona.

S4-04 queda protegido por `clerical-person-id-continuity.test.mjs`. Los adaptadores de sacerdote y obispo traducen sus identificadores heredados a `selected_person_id`; el motor bloquea transiciones sin el grado sacramental previo o con el grado destino ya registrado; reutiliza la fila bloqueada de `persons`; acumula diaconado, presbiterado y episcopado en `ordination_events`; actualiza un único `clergy_profiles`; y devuelve el mismo `person_id` como resultado canónico.

S4-05 queda protegido por `religious-priest-identity-unification.test.mjs`. Sacerdotes diocesanos y religiosos usan el mismo flujo `priest`; la variante religiosa exige instituto, congregación u orden; reutiliza el diácono seleccionado mediante `selected_person_id`; registra el presbiterado sobre la misma persona; actualiza un único `clergy_profiles`; crea o actualiza `religious_profiles` mediante conflicto por `person_id`; y deriva la incardinación como `religious_institute`.

S4-06 queda protegido por `person-wizard-office-level-compatibility.test.mjs`. El servicio compartido resuelve el nivel desde el nodo estructural activo de la entidad y obtiene únicamente los cargos activos mapeados en `structure_level_office_configurations`; si falta entidad, nodo, nivel o mapeo, devuelve una lista vacía. No existe fallback a todos los cargos activos.

S4-07 queda protegido por `assignment-lifecycle-contract.test.mjs`. El gestor distingue estados activos, período vencido con continuidad, renovación, sustitución, vacante, suspensión y cierre; una vacante no exige persona; conserva inicio, fin previsto, fin real y fecha efectiva; permite enlazar predecesor y sucesor; y diferencia la sustitución automática de cargos con titular único del cierre explícito en cargos con múltiples titulares.

S4-08 queda protegido por `assignment-impact-preview.test.mjs`. El gestor calcula los titulares vigentes antes de guardar, muestra cuáles se cerrarán o conservarán, presenta el predecesor explícito, proyecta la cantidad de titulares resultante y bloquea operaciones que excedan la cardinalidad máxima.

S4-09 queda protegido por `source-verification-contract.test.mjs`. Personas y nombramientos comparten `normalizeSourceVerification`, que normaliza nombre, URL HTTP/HTTPS, fecha de revisión y estado; rechaza estados desconocidos; y no permite confirmar una verificación sin nombre de fuente y fecha.

S4-10 queda protegido por `missing-clergy-profile-repair.test.mjs`. Las migraciones `repair_missing_canonical_clergy_profiles` y `harden_missing_clergy_profile_diagnostic` fueron aplicadas en Supabase. El diagnóstico confirmó `0` personas con ordenaciones canónicas activas y sin `clergy_profiles`. La implementación privilegiada quedó en `internal` y la fachada pública usa `SECURITY INVOKER`.

S4-11 cerró con CI en verde: documentación, auditorías, TypeScript, pruebas, CodeQL y build aprobados. La cadena de migraciones fue aplicada en el proyecto autorizado y el asesor de seguridad dejó de reportar la función diagnóstica introducida en este sprint.

## Criterios de cierre

- [x] Una persona conserva un único ID durante toda su historia.
- [x] Ningún cargo actual incompatible o equivalente puede duplicarse silenciosamente.
- [x] Toda sustitución conserva predecesor y sucesor.
- [x] Los cargos incompatibles se bloquean o requieren confirmación explícita según contrato.
- [x] Las operaciones críticas conservan validación, permiso, alcance, transacción, auditoría y prueba.

## Dependencias operativas no bloqueantes

S3-06 permanece abierto hasta disponer de una URL autorizada y cuentas diferenciadas para ejecutar la matriz E2E autenticada. `Production Playwright and Axe` y la auditoría crítica de dependencias continúan condicionadas por sus disparadores protegidos. Estas validaciones no invalidan el cierre técnico del Sprint 4 y deben conservarse en el backlog operativo.

Consulta [la auditoría de flujos de personas](./sprint-4-person-flows-audit.md).