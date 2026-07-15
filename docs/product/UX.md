# Experiencia de usuario de SINEP RD

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: producto y frontend

## Objetivo

SINEP RD debe permitir que usuarios públicos, editores y administradores comprendan el contexto, completen recorridos críticos con mínima asistencia y puedan recuperarse de errores sin perder trabajo.

## Principios UX

- Mostrar contexto, ámbito activo y estado antes de pedir una acción.
- Reducir decisiones irrelevantes y texto libre.
- Mantener navegación consistente entre dominios.
- Explicar restricciones de permiso y alcance.
- Conservar datos ante errores recuperables.
- Mostrar procedencia, actualización y vigencia cuando afecten la confianza.
- Distinguir información vigente, histórica, pendiente y no verificada.
- Diseñar accesibilidad y responsive como requisitos de flujo, no como correcciones posteriores.

## Recorridos prioritarios

### Público

Buscar una realidad eclesial, navegar su contexto, abrir una ficha, comprender vigencia y procedencia y continuar hacia entidades relacionadas.

### Editor

Entrar en su ámbito, localizar un registro, editar o proponer cambios, resolver errores, revisar impacto y confirmar una operación autorizada.

### Administrador

Comprender el ámbito activo, revisar tareas y alertas, gestionar personas, estructuras, organización, nombramientos e importaciones mediante contratos explícitos y auditados.

## Criterios de lanzamiento UX

Antes de una versión pública:

1. Las rutas comparten una gramática visual.
2. No existen páginas degradadas o sin estilos.
3. La navegación pública y administrativa es clara y no duplicada.
4. Cada pantalla tiene una acción primaria reconocible.
5. Claro y oscuro cumplen contraste AA.
6. El botón flotante de accesibilidad es completamente operable.
7. La plataforma funciona a 320 px y 400 % de zoom.
8. Los formularios conservan datos y explican errores.
9. Las operaciones sensibles muestran impacto antes de ejecutarse.
10. Los indicadores explican alcance, fecha y fuente.
11. Las fichas distinguen datos vigentes, históricos y no verificados.
12. Las tablas y organigramas funcionan en móvil y con teclado.
13. Los filtros relevantes pueden compartirse mediante URL.
14. Los estados de carga, éxito, error y vacío están diseñados.
15. Las rutas críticas tienen pruebas E2E, accesibilidad y regresión visual aplicables.
16. Los recorridos principales han sido validados con usuarios representativos.

## Métricas iniciales

- Tareas críticas completadas: objetivo ≥ 90 %.
- Rutas con contraste AA: 100 %.
- Rutas sin scroll horizontal global: 100 %.
- Rutas críticas con pruebas visuales: 100 %.
- Operaciones sensibles con resumen de impacto: 100 %.
- Navegación completa por teclado en rutas críticas: 100 %.
- Preferencias de accesibilidad persistentes: 100 %.

La analítica UX puede registrar búsquedas sin resultados, formularios abandonados, pasos con mayor error, filtros usados, acciones que requieren ayuda y rendimiento por ruta. No debe registrar datos personales sensibles ni contenido privado de formularios.

## Gobierno

Cada funcionalidad nueva debe definir flujo, componentes reutilizados, estados del sistema, accesibilidad, responsive, pruebas, métricas y criterios de aceptación. Una implementación exclusivamente técnica no se considera UX cerrada.

El backlog ejecutable de UX se mantiene en [el backlog UX activo](../sprints/active/ux-backlog.md) y debe revisarse al cierre de cada sprint.
