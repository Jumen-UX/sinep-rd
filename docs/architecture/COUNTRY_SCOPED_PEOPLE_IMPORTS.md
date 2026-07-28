# Importaciones y diagnósticos de personas por país

> Estado: implementado y validado como parte de la fase 2E
> Última revisión: 2026-07-28
> Alcance: aplicación de lotes de personas y nombramientos, incompatibilidades canónicas y diagnósticos administrativos

## Migraciones

Aplicado mediante:

- `20260728150859_scope_people_imports_and_diagnostics_by_country.sql`;
- `20260728151123_fix_import_application_rpc_chain.sql`;
- `20260728151455_fix_people_diagnostic_rpc_chain.sql`;
- `20260728151551_align_missing_clergy_diagnostic_permission.sql`;
- `20260728151646_fix_orphan_photo_owner_type.sql`.

La secuencia se conserva completa porque las migraciones posteriores corrigen contratos de ejecución y tipos detectados durante pruebas reales.

## Motores de importación sellados

Los motores históricos fueron renombrados a:

- `admin_apply_person_import_batch_unscoped`;
- `admin_apply_assignment_import_batch_unscoped`.

No tienen `EXECUTE` para `public`, `anon` ni `authenticated`.

Las nuevas funciones con los nombres canónicos actúan como fachadas de autorización antes de delegar al motor sellado.

## Lotes de personas

Antes de aplicar un lote se verifica:

1. sesión activa;
2. permiso `imports.apply`;
3. `scope_entity_id` administrable;
4. país resoluble para el lote;
5. entidad resuelta de cada fila;
6. coincidencia entre el país de la fila y el país del lote;
7. permiso `imports.apply` sobre la entidad de la fila;
8. permiso `people.create_proposal` sobre esa entidad.

Una fila que intenta introducir una persona en otro país aborta el lote completo antes de invocar el escritor interno.

## Lotes de nombramientos

Cada fila debe resolver:

- persona;
- cargo;
- entidad.

La fachada comprueba:

- país de la entidad igual al país del lote;
- `imports.apply` sobre la entidad;
- `appointments.create_proposal` sobre la entidad;
- `appointments.create_proposal` sobre la persona mediante su proyección persona→entidades.

Esto impide usar una persona interna CO en un nombramiento DO o aplicar una fila hacia una entidad de otro país.

## Dispatcher público

`public.admin_apply_import_batch(jsonb)` se convirtió en una fachada `SECURITY DEFINER` con `search_path` fijo.

El dispatcher privado exige:

- usuario autenticado;
- `imports.apply`;
- lote existente;
- `scope_entity_id` canónico;
- autorización sobre esa entidad.

Solo después ejecuta el preflight y deriva al motor específico.

La primera prueba detectó que la fachada pública anterior era `SECURITY INVOKER` y no podía llamar al dispatcher privado sellado. La corrección no concedió acceso directo a funciones internas; selló la cadena pública completa.

## Incompatibilidades canónicas

`resolve_assignment_canonical_incompatibility` dejó de aceptar el bypass nacional.

Ahora resuelve la entidad mediante el nombramiento y exige `appointments.approve` dentro del país y alcance correspondientes. La mutación se registra con `create_audit_log` y alcance territorial explícito.

## Diagnóstico de perfiles clericales faltantes

El conteo usa `current_user_can_manage_person('people.view', person_id)`.

Se eligió `people.view` porque es el permiso operativo asignado a los roles de consulta y administración. La primera versión utilizó `people.view_private`, una clave no asignada a `national_admin`, y el diagnóstico devolvía cero aun para personas dentro del país. La migración posterior corrigió exclusivamente el permiso, sin reintroducir un bypass.

## Fotografías huérfanas

Una fotografía huérfana no tiene persona ni entidad canónica desde la cual derivar país. Por eso el inventario está reservado a:

- `super_admin`;
- permiso `people.update_proposal`.

La fachada pública es `SECURITY DEFINER`, pero el motor privado no es ejecutable directamente.

Durante la prueba se detectó que `storage.objects.owner_id` es texto, mientras la función devolvía UUID. La corrección:

- convierte a UUID solo valores con formato válido;
- devuelve `null` para propietarios heredados o no UUID;
- evita que un objeto antiguo interrumpa todo el inventario.

## Evidencia transaccional

### Aplicación de lotes

Con lotes y filas temporales y `ROLLBACK` se confirmó:

- una fila de persona DO se aplicó y enlazó su `target_record_id`;
- una fila de nombramiento DO se aplicó y enlazó su `target_record_id`;
- los lotes CO permanecieron en `validated` y fueron rechazados con `42501`;
- los lotes DO pasaron a `applied`;
- las auditorías conservaron `country_iso2='DO'`.

La prueba inicial con lotes vacíos fue rechazada correctamente por el preflight, porque la cantidad persistida debe coincidir con el resumen del lote. La matriz definitiva utilizó filas completas y el flujo real.

### Diagnósticos

Se confirmó:

- el administrador DO contabiliza una persona DO con ordenación y sin perfil clerical;
- no contabiliza el equivalente CO;
- el administrador nacional no puede listar fotografías huérfanas;
- `super_admin` puede ejecutar el inventario;
- la conversión de `owner_id` no falla.

Ningún lote, fila, persona, nombramiento u ordenación temporal quedó persistido.

## Contratos automatizados

`tests/people-import-country-scope-contract.test.mjs` verifica:

- las cinco versiones exactas de migración;
- motores `*_unscoped` sellados;
- país y permisos de cada fila;
- persona y entidad en nombramientos;
- dispatcher público `SECURITY DEFINER`;
- resolución de incompatibilidades auditada;
- diagnósticos mediante fachadas selladas;
- `people.view` como permiso operativo;
- inventario de fotos reservado a `super_admin`;
- conversión segura del propietario de Storage.

## Pendientes

1. Migrar importaciones de estructuras y eventos con la misma profundidad por fila.
2. Revisar aplicación mixta, noop, actualización y reversión lógica por país.
3. Migrar reportes finales y exportaciones de lotes.
4. Añadir pruebas E2E con archivos DO y CO desde cuentas diferenciadas.
5. Retirar los consumidores restantes de los helpers nacionales heredados.
