# Personas y nombramientos por país

> Estado: primer bloque implementado y validado como parte de la fase 2E
> Última revisión: 2026-07-28
> Alcance: personas, perfiles clericales y religiosos, ordenaciones, nombramientos, elegibilidad y flujos canónicos

## Principio de modelado

Una persona no recibe un país administrativo mediante una columna fija en `persons`.

Su alcance territorial se deriva de sus relaciones eclesiales canónicas. Una misma persona puede tener vínculos legítimos con más de un país a lo largo de su historia o simultáneamente, por ejemplo mediante servicio, incardinación, nombramientos o responsabilidades institucionales.

## Migración

Aplicado mediante:

- `20260728144957_scope_people_and_assignments_by_country.sql`.

## Proyección persona→entidades

`app_private.person_scope_entities(person_id)` reúne entidades relacionadas desde:

- nombramientos con entidad directa;
- unidades organizativas de los nombramientos;
- entidad de servicio actual del perfil clerical;
- entidad de incardinación clerical;
- entidad de servicio del perfil religioso;
- jurisdicciones de roles episcopales;
- historial canónico de incardinaciones;
- auditorías previas de la propia persona con alcance resoluble.

La proyección devuelve entidades, no códigos de país. La decisión final se delega a `current_user_can_manage_entity`, que verifica permiso, país y alcance jerárquico.

## Gestión de personas

`current_user_can_manage_person(permission, person_id)` autoriza cuando el actor puede ejercer el permiso solicitado sobre al menos una entidad canónica asociada a la persona.

Se eliminaron como criterios de autorización:

- poseer `national_admin` sin comparar país;
- `current_user_is_super_or_national()`;
- ser el usuario que creó la fila.

Una persona interna sin ningún vínculo territorial resoluble queda reservada a `super_admin`. No se asigna silenciosamente a República Dominicana ni al país del creador.

## Lectura

### Personas

- una persona activa y pública continúa visible en el canal público;
- una persona interna, privada o inactiva exige `people.view` mediante su proyección territorial.

### Perfiles clericales y religiosos

- el canal público solo obtiene perfiles cuya persona está activa y publicada;
- el canal autenticado hereda la autorización de la persona;
- un administrador nacional no puede leer perfiles internos de otro país.

### Ordenaciones

- solo se publican eventos activos y públicos cuya persona también sea pública;
- las ordenaciones internas requieren autorización sobre la persona;
- las escrituras directas de clientes autenticados fueron retiradas.

### Nombramientos

- los nombramientos publicados y dentro de su ventana temporal continúan públicos;
- cualquier nombramiento interno exige `appointments.view` sobre su entidad o unidad canónica;
- un nombramiento sin alcance queda reservado a `super_admin`, aunque el esquema ya exige entidad o unidad mediante el constraint del centro de revisión.

## Escritores migrados

### Registro canónico de personas

`admin_save_canonical_person` exige para actores no globales:

- una entidad explícita dentro de su alcance;
- autorización sobre una persona existente cuando el flujo reutiliza identidad;
- `appointments.create_proposal` cuando el registro crea un nombramiento.

Se retiró el fallback implícito a `current_user_root_jurisdiction_id()` para autorizar el wrapper. El motor interno permanece encapsulado detrás de esta fachada fail-closed.

### Creación de nombramientos

`admin_save_position_assignment` ahora:

- exige sesión;
- deriva la entidad desde la unidad organizativa cuando corresponde;
- rechaza discrepancias entre entidad y unidad;
- exige `appointments.create_proposal` sobre la entidad;
- exige que la persona también sea administrable para ese permiso;
- valida predecesor y sucesor mediante su entidad canónica;
- no utiliza `current_user_has_scope_access` ni el bypass nacional;
- audita entidad y unidad.

Esto impide tanto nombrar dentro de una entidad CO desde una cuenta DO como utilizar en DO una persona interna cuyo único alcance sea CO.

### Fallecimiento

`admin_mark_person_deceased` verifica `people.update_proposal` sobre la persona antes de modificarla. La auditoría selecciona una entidad que el actor pueda administrar y conserva el país derivado.

### Elegibilidad

`admin_check_position_assignment_eligibility` exige autorización sobre la persona y, cuando se indica, sobre la entidad del nombramiento. La consulta de elegibilidad ya no funciona como un lector transversal de personas.

### Candidatos e importaciones

- `admin_list_unordained_people` filtra cada candidato mediante `current_user_can_manage_person('people.create_proposal', person_id)`;
- `import_person_matches` filtra coincidencias mediante `current_user_can_manage_person('imports.prepare', person_id)`.

## Escrituras RPC-only

Se revocó `INSERT`, `UPDATE` y `DELETE` para `authenticated` sobre:

- `religious_profiles`;
- `ordination_events`.

`persons`, `clergy_profiles` y `position_assignments` ya estaban protegidos por contratos RPC anteriores.

## Evidencia transaccional

Las pruebas se ejecutaron con personas, perfiles, ordenaciones y nombramientos temporales y finalizaron con `ROLLBACK`.

### Matriz de lectura

Se confirmó que:

- `anon` ve una persona pública CO, su perfil clerical, ordenaciones públicas y nombramiento publicado;
- `anon` no ve personas internas DO/CO ni una persona interna sin alcance;
- un administrador DO ve personas, perfiles, ordenaciones y nombramientos internos DO;
- no ve los equivalentes internos CO;
- conserva la lectura de datos públicos CO;
- no puede administrar una persona interna sin alcance;
- `super_admin` sí puede administrar esa persona sin alcance;
- no quedan escrituras directas sobre perfiles religiosos u ordenaciones.

### Registro canónico

- creación de persona con entidad DO: aceptada;
- creación con entidad CO: rechazada;
- auditoría DO: `country_iso2='DO'` y entidad país correcta.

### Nombramientos

- persona DO en entidad DO: aceptada;
- persona DO en entidad CO: rechazada;
- persona CO en entidad DO: rechazada;
- auditoría del nombramiento aceptado: país y entidad DO.

### Fallecimiento

- fallecimiento de persona DO: aceptado;
- fallecimiento de persona CO: rechazado;
- auditoría del caso DO: fecha, entidad y país correctos.

Ningún registro temporal quedó persistido.

## Interacción detectada durante pruebas

Insertar un perfil clerical de una persona marcada como sacerdote activa el trigger canónico de sincronización de ordenaciones. La prueba inicial intentó insertar manualmente un evento de diaconado duplicado y fue revertida por la restricción única `(person_id, degree)`.

La matriz definitiva reutilizó los eventos generados por el trigger, validando el comportamiento real del dominio en lugar de desactivarlo.

## Contratos automatizados

`tests/people-country-scope-contract.test.mjs` verifica:

- versión exacta de la migración;
- fuentes de la proyección persona→entidades;
- ausencia de bypass nacional y autorización por creador;
- RLS territorial de personas, perfiles, ordenaciones y nombramientos;
- revocación de DML directo;
- protección de registro, nombramiento y fallecimiento;
- validación de entidad, unidad, persona, predecesor y sucesor;
- filtrado de candidatos e importaciones.

## Pendientes relacionados

1. Migrar aplicación de importaciones de personas y nombramientos.
2. Migrar resolución de incompatibilidades canónicas de nombramientos.
3. Revisar diagnósticos de perfiles clericales faltantes y fotos huérfanas.
4. Auditar privilegios por columna de todos los perfiles públicos.
5. Migrar reportes, búsqueda y exportaciones de personas.
6. Crear evidencia E2E bidireccional con cuentas nacionales DO y CO.
7. Retirar los consumidores restantes de `current_user_is_super_or_national()` y `current_user_has_scope_access()`.
