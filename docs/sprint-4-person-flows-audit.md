# Sprint 4 — Auditoría de flujos de personas

Estado: S4-01 completado
Fecha: 2026-07-15

## Alcance revisado

Se revisaron los flujos administrativos de alta de obispo, sacerdote, diácono, religioso/a y persona laica, junto con sus límites de dominio, servicios y continuidad de identidad.

## Hallazgos por flujo

### Obispo

- Vive en el dominio de clero y delega catálogos y persistencia a `bishop-admin-service`.
- Permite seleccionar una persona con presbiterado existente o crear una identidad externa.
- El modo normal conserva la misma persona y añade episcopado, función, estado, dignidad y cargo.
- Incluye fuente documental y sucesión apostólica.

### Sacerdote

- Vive en el dominio de clero y usa `priest-admin-service`.
- Permite continuar una persona con diaconado existente o crear una identidad nueva.
- Distingue sacerdote diocesano y religioso sin convertir esa condición en otro tipo de persona.
- Conserva borrador local, catálogo de cargos, asignación rápida y continuidad del `person_id`.

### Diácono

- Vive en el dominio de clero y usa `deacon-admin-service`.
- Registra diácono permanente, transitorio o externo.
- Actualmente el alta parte de una identidad nueva; la continuidad posterior se resuelve desde el flujo de sacerdote.
- Incluye validación privada, foto, ordenación, incardinación y cargo opcional.

### Vida consagrada

- Vive en el dominio de vida consagrada y usa `religious-admin-service`.
- Registra religiosa, religioso no ordenado o persona consagrada laica.
- El caso sacerdote religioso se redirige al flujo de sacerdote, evitando una segunda identidad clerical.
- Mantiene profesión religiosa y servicio como dimensiones independientes.

### Persona laica

- Vive en el dominio de personas y usa `lay-person-admin-service`.
- La condición laical se deriva de la ausencia de ordenaciones, no de un tipo irreversible.
- La identidad queda preparada para recibir posteriormente una ordenación sobre la misma ficha.
- Incluye validación privada, foto y servicio o cargo opcional.

## Contrato canónico del asistente común

Todos los flujos de persona deben aplicar el siguiente contrato:

1. **Resolver identidad primero**
   - buscar coincidencias antes de crear;
   - seleccionar una persona existente cuando corresponda;
   - crear una identidad solo después de una decisión explícita.

2. **Mantener una única identidad**
   - `person_id` es estable durante toda la vida de la persona;
   - diaconado, presbiterado, episcopado, vida religiosa, estado y dignidad son historiales o dimensiones;
   - ningún cambio ministerial crea otra fila de persona.

3. **Separar identidad de condición eclesial**
   - los datos personales pertenecen a la identidad;
   - las ordenaciones pertenecen al historial sacramental;
   - la vida consagrada pertenece a su historial propio;
   - los cargos y servicios pertenecen a nombramientos o asignaciones.

4. **Aplicar el mismo orden de pasos**
   - búsqueda o selección de persona;
   - identidad y datos privados;
   - dimensión eclesial correspondiente;
   - servicio, cargo y alcance;
   - fuente, revisión e impacto antes de guardar.

5. **Persistencia segura**
   - toda escritura pasa por servicio tipado y contrato canónico;
   - la operación debe validar permiso, alcance, duplicados y compatibilidad;
   - creación o actualización de identidad, historial y nombramiento debe ser transaccional y auditada.

6. **Respuesta uniforme**
   - devolver como mínimo `person_id`, `slug`, operación realizada y advertencias;
   - distinguir `created`, `reused`, `updated`, `noop` y `blocked`;
   - exponer el impacto sobre historiales y cargos antes del guardado definitivo.

## Brechas detectadas

1. La búsqueda de identidad no aparece como una etapa uniforme en todos los asistentes.
2. Obispo y sacerdote tienen selección explícita de antecedentes; diácono, religioso y laico todavía dependen más del alta directa.
3. Se repiten utilidades de nombre, slug, valores vacíos, carga de foto y filtrado de cargos.
4. La forma de mostrar fuentes, advertencias, impacto y resultado no es todavía homogénea.
5. El contrato común no está protegido por una prueba transversal única.

## Decisión de arquitectura

S4-02 debe implementarse antes de modificar visualmente los cinco asistentes. La siguiente pieza será un servicio compartido de resolución de identidad que devuelva candidatos, señales de coincidencia y una decisión explícita de reutilizar o crear. Después, S4-03 podrá reutilizar ese contrato sin duplicar lógica de detección en cada dominio.

## Criterio de cierre de S4-01

S4-01 se considera completado porque:

- los cinco flujos fueron clasificados por dominio y servicio;
- se confirmó la continuidad canónica diácono → sacerdote → obispo;
- se confirmó que sacerdote religioso no crea una identidad paralela;
- se fijó el contrato común de identidad, dimensión eclesial, nombramiento, fuente y auditoría;
- las brechas quedaron ordenadas para S4-02 y S4-03.
