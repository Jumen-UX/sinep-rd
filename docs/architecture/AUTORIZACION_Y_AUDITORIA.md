# Autorización, alcance y auditoría

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: seguridad y arquitectura

## Principio

Una sesión autenticada no equivale a autorización administrativa. Toda operación sensible debe resolver actor, estado de cuenta, rol vigente, permiso y alcance efectivo antes de mutar datos.

## Autorización

- Los usuarios no pueden autoasignarse roles ni alcances.
- Suspensión e inactivación prevalecen sobre una sesión válida.
- Los permisos expresan capacidad funcional.
- El alcance expresa sobre qué entidad, estructura o unidad puede ejercerse esa capacidad.
- La interfaz puede ocultar acciones no disponibles, pero el servidor y la base de datos deben aplicar la decisión definitiva.

## Alcance

El alcance territorial debe derivarse del motor estructural canónico. El alcance organizativo debe respetar organigrama, unidad y entidad eclesiástica asociada. No se deben reconstruir descendencias desde nombres, slugs o relaciones institucionales paralelas.

Las operaciones administrativas deben rechazar objetivos fuera del alcance del actor aunque el identificador sea válido y conocido.

## Contratos privilegiados

Las implementaciones privilegiadas deben permanecer en esquemas internos cuando corresponda. Las fachadas públicas autenticadas deben validar `auth.uid()`, permiso, alcance e invariantes antes de delegar la operación.

`anon` no debe recibir ejecución sobre contratos administrativos. La exposición de una función `SECURITY DEFINER` a `authenticated` solo es aceptable cuando la fachada es intencional, acotada y protegida por validaciones internas explícitas.

## Auditoría

Toda mutación sensible debe registrar, según aplique:

- actor;
- acción;
- recurso y dominio;
- jurisdicción o alcance;
- estado anterior y posterior;
- identificadores canónicos afectados;
- fuente o contexto de la operación;
- fecha de ejecución.

La auditoría no debe almacenar contraseñas, tokens, secretos ni contenido privado innecesario.

## Operaciones históricas

Nombramientos, traslados, ordenaciones, fallecimientos, cambios estructurales y transiciones de ciclo de vida se registran como operaciones explícitas. No se reemplaza silenciosamente el estado anterior cuando existe impacto histórico.

## Pruebas obligatorias

Los contratos sensibles deben cubrir al menos:

- actor autorizado dentro del alcance;
- actor autorizado fuera del alcance;
- usuario autenticado sin permiso;
- usuario sin rol vigente;
- usuario suspendido o inactivo cuando aplique;
- auditoría de la operación exitosa;
- atomicidad o rollback ante fallo parcial.

Los recorridos de beta deben demostrar aislamiento bidireccional entre alcances diocesanos distintos mediante cuentas no productivas separadas.
