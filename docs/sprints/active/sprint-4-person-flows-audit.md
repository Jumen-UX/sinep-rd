# Sprint 4 — Auditoría de flujos de personas

> Estado: S4-01 completado
> Fecha: 2026-07-15

## Alcance

Se revisaron los flujos administrativos de alta de obispo, sacerdote, diácono, religioso o religiosa y persona laica, junto con sus servicios y continuidad de identidad.

## Hallazgos

- Obispo: puede continuar una persona con presbiterado y añadir episcopado, función, estado, dignidad y cargo sobre la misma identidad.
- Sacerdote: puede continuar una persona con diaconado; la condición diocesana o religiosa no crea otro tipo de persona.
- Diácono: el alta todavía parte principalmente de identidad nueva; la continuidad posterior se resuelve desde sacerdote.
- Vida consagrada: mantiene profesión religiosa y servicio como dimensiones independientes; el sacerdote religioso usa el flujo sacerdotal.
- Persona laica: la condición laical se deriva de la ausencia de ordenaciones y la identidad puede recibir una ordenación posterior.

## Contrato canónico del asistente común

1. Resolver identidad antes de crear.
2. Mantener un `person_id` estable durante toda la vida de la persona.
3. Separar identidad, historial sacramental, vida consagrada y nombramientos.
4. Aplicar un orden común: identidad; datos privados; dimensión eclesial; servicio y alcance; fuente, revisión e impacto.
5. Persistir mediante servicios tipados y contratos canónicos con permiso, alcance, duplicados, compatibilidad, transacción y auditoría.
6. Devolver una respuesta uniforme que distinga `created`, `reused`, `updated`, `noop` y `blocked`.

## Brechas

- La búsqueda de identidad no aparece todavía como etapa uniforme en todos los asistentes.
- Diácono, religioso y laico dependen más del alta directa que obispo y sacerdote.
- Existen utilidades repetidas de nombre, slug, valores vacíos, foto y filtrado de cargos.
- Fuentes, advertencias, impacto y resultado no se muestran de forma homogénea.
- La interfaz común debe quedar protegida por contratos transversales.

## Decisión

La resolución compartida de identidad precede a la migración visual de los cinco asistentes. S4-03 debe reutilizar el contrato común y no duplicar lógica de detección por dominio.
