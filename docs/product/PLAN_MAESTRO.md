# Plan Maestro de SINEP RD

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: producto y arquitectura

## Propósito

SINEP RD es el Sistema Nacional de Información Eclesiástica y Pastoral de República Dominicana. Su propósito es registrar, relacionar, consultar y auditar información institucional, territorial, pastoral, administrativa, colegial e histórica sin confundir esas dimensiones ni perder su vigencia temporal.

## Principios del producto

1. Una persona conserva una identidad única durante toda su trayectoria eclesial.
2. La identidad institucional, la jerarquía territorial y la organización interna son dimensiones distintas.
3. Los cambios históricos se registran como operaciones explícitas; no se sobrescribe silenciosamente la historia.
4. La interfaz debe priorizar selección, catálogos y búsqueda antes que texto libre.
5. Toda operación sensible valida actor, permiso, alcance, invariantes y auditoría.
6. La publicación pública se deriva de fuentes canónicas y respeta privacidad, verificación y vigencia.
7. Ninguna funcionalidad se considera completa solo por compilar: debe cubrir estados, errores, accesibilidad, responsive y pruebas aplicables.

## Dominios canónicos

- Personas e identidad.
- Clero y trayectoria sacramental.
- Vida consagrada.
- Entidades eclesiásticas.
- Estructuras territoriales configurables.
- Organización pastoral, administrativa y colegial.
- Cargos y nombramientos.
- Eventos históricos.
- Importaciones controladas.
- Acceso, permisos y alcance.
- Auditoría y calidad de datos.
- Portal público, búsqueda y fichas.

## Decisiones estructurales permanentes

- `ecclesiastical_entities` representa identidad institucional.
- `structure_templates`, `structure_levels`, `structure_nodes` y `structure_node_edges` representan jerarquía territorial configurable.
- `organization_charts` y `organization_units` representan organización interna.
- Los cargos y nombramientos relacionan personas con responsabilidades, alcance y vigencia sin redefinir las estructuras.
- `structure_node_edges` es la fuente canónica de parentesco territorial.
- Aprobar y publicar son operaciones separadas.
- Las rutas de `src/app` son puntos de entrada delgados y delegan reglas e I/O a dominios y servicios.

## Criterios de calidad

Cada cambio debe preservar:

- integridad histórica;
- separación de responsabilidades;
- autorización por permiso y alcance;
- auditoría de mutaciones sensibles;
- validación de entradas;
- accesibilidad WCAG 2.2 AA como objetivo de producto;
- experiencia responsive y compatible con modo claro y oscuro;
- pruebas contractuales, unitarias, de integración o E2E según el riesgo;
- documentación canónica sincronizada con el código.

## Estado del producto

SINEP RD es una candidata a beta interna. Los cierres técnicos de sprints no equivalen a aprobación de datos, certificación operativa ni apertura pública. Los controles de acceso con cuentas diferenciadas, restauración, respuesta a incidentes, revisión institucional y validación UX continúan como condiciones de salida.

## Gobierno documental

Este documento define la visión y los principios estables. La ejecución se mantiene en [la hoja de ruta vigente](./ROADMAP.md). El sprint activo se mantiene bajo `docs/sprints/active`. Las evidencias y cierres terminados se archivan bajo `docs/archive/sprints`.
