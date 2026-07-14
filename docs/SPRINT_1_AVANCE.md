# Sprint 1 — Avance de arquitectura por dominios

Fecha de corte: 14 de julio de 2026.

## Objetivo

Mantener las rutas de Next.js como puntos de entrada delgados y concentrar interfaz, acceso a datos y reglas de aplicación dentro de `src/features`.

## Trabajo completado

- `/admin` delega en `features/admin/dashboard`.
- `/admin/personas` delega en `features/personas`.
- `/admin/asignaciones` delega en `features/appointments`.
- `/admin/nuevo/sacerdote` delega en `features/clero/priest`.
- `/admin/configuracion/cargos` fue movida desde una página monolítica a `features/appointments`.
- El acceso a catálogos y configuraciones de cargos quedó encapsulado en `office-configuration-admin-service.ts`.
- La creación de configuraciones de cargos dejó de escribir directamente en `office_configurations` y ahora usa `admin_save_office_configuration`, RPC atómica y auditada.
- Se añadió una prueba contractual que impide devolver acceso directo a Supabase en las rutas administrativas de nombramientos y cargos.

## Regla arquitectónica aplicada

Las rutas bajo `src/app` pueden resolver parámetros, autenticación inicial y composición, pero no deben contener consultas de dominio, mutaciones directas ni reglas de negocio. Las operaciones críticas deben pasar por servicios de feature y RPC auditadas.

## Pendientes para cerrar Sprint 1

1. Inventariar las rutas restantes de `src/app` y clasificar cada una como delgada, transitoria o monolítica.
2. Extraer las páginas monolíticas restantes por prioridad de riesgo: usuarios y permisos, revisión, estructuras, eventos e importaciones.
3. Confirmar que cada RPC crítica tenga un único servicio consumidor por dominio.
4. Eliminar utilidades duplicadas de normalización, manejo de errores y alcance.
5. Ampliar las pruebas contractuales de límites de ruta sin bloquear rutas todavía no migradas.

## Criterio de cierre

Sprint 1 se considerará cerrado cuando las rutas críticas deleguen en features, no existan escrituras de dominio directas desde páginas y la separación esté protegida por pruebas automatizadas.
