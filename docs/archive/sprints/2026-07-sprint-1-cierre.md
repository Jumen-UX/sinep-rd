# Sprint 1 — Cierre de arquitectura por dominios

> Estado: archivado
> Fecha de cierre: 2026-07-14

Sprint 1 cerró la separación de rutas y dominios administrativos. El inventario final registró 55 rutas administrativas: 51 delegadas en `src/features`, 4 de composición y 0 con I/O directo. TypeScript, 274 pruebas y el build de producción completaron correctamente.

La regla consolidada fue mantener `src/app` como capa de rutas, layouts, metadata y composición, mientras consultas, mutaciones y reglas de aplicación residen en features y servicios tipados.

La deuda trasladada incluyó la actualización transaccional de cargos por nivel, la unificación de catálogos de asistentes, utilidades duplicadas y optimizaciones de CI. Parte de esa deuda fue resuelta en Sprint 2.

Este archivo conserva evidencia histórica. La norma vigente está en `docs/architecture/CONVENCION_MODULOS.md`.
