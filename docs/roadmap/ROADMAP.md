# Hoja de ruta de SINEP RD

> Estado: vigente  
> Actualizada: 2026-07-10  
> Regla: validar cada punto contra código, migraciones y pruebas antes de iniciarlo

## Estado consolidado

La base cuenta con registro canónico de personas, dimensiones clericales, estructura configurable, permisos por jurisdicción, auditoría, revisión de incompatibilidades, portal público y CI con typecheck, pruebas y build.

La importación controlada ya persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección por fila y conserva auditoría de preparación. La aplicación a registros canónicos continúa intencionalmente deshabilitada hasta completar revisión, idempotencia y pruebas integrales.

## Prioridad 0 — operación segura

- [ ] Aplicar y verificar en cada entorno todas las migraciones pendientes. Las migraciones de importación están aplicadas y verificadas en el proyecto Supabase conectado.
- [ ] Ejecutar pruebas de integración contra una instancia no productiva de Supabase.
- [ ] Realizar smoke test autenticado de las rutas administrativas críticas. La preparación, corrección y revalidación por RPC ya tienen smoke test autenticado.
- [ ] Confirmar protección contra contraseñas filtradas y revisar asesores de seguridad de Supabase. Los asesores fueron revisados; la protección contra contraseñas filtradas continúa pendiente de activación.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal.

## Prioridad 1 — importación controlada

Disponible actualmente:

- Plantillas CSV, lectura local, hash SHA-256 y vista previa limitada.
- Persistencia de lotes, filas e incidencias con RLS por alcance.
- Validación de campos, catálogos, fechas, duplicados y relaciones.
- Historial de lotes, detalle por fila, corrección y revalidación.
- Auditoría de preparación y correcciones.
- Aplicación canónica deshabilitada explícitamente.

### Completado

- [x] Crear tablas de lote, filas, incidencias y registro futuro de cambios aplicados.
- [x] Implementar RPC de preparación y validación transaccional.
- [x] Validar catálogos, relaciones, alcance y duplicados por fila.
- [x] Permitir corrección y reintento del lote sin modificar registros canónicos.
- [x] Añadir historial, detalle e incidencias accesibles según el alcance administrativo.
- [x] Auditar preparación y corrección sin guardar datos privados innecesarios en el log.

### Pendiente

- [ ] Añadir revisión y aprobación explícita del lote antes de aplicarlo.
- [ ] Implementar RPC de aplicación transaccional e idempotente por tipo de importación.
- [ ] Registrar cada alta, modificación o no-op en `import_batch_changes`.
- [ ] Impedir doble aplicación y definir compensación o reversión lógica.
- [ ] Añadir reporte final descargable del lote aplicado.
- [ ] Añadir lectura XLSX después de evaluar dependencia, límites y seguridad.
- [ ] Auditar cada aplicación canónica y enlazar sus registros creados o modificados.

## Prioridad 2 — calidad del producto

- [ ] Añadir pruebas E2E de portal público, login y flujos administrativos críticos.
- [ ] Automatizar WCAG con Axe y recorridos de teclado.
- [ ] Incorporar Lighthouse/Core Web Vitals en una compuerta medible.
- [ ] Probar navegación móvil real y tablas adaptativas.
- [ ] Añadir metadata dinámica para fichas públicas y URLs canónicas.
- [ ] Optimizar imágenes remotas con una política explícita.

## Prioridad 3 — mantenibilidad

- [ ] Consolidar servicios y selectores jerárquicos que todavía tienen variantes heredadas.
- [ ] Reducir páginas con lógica de dominio dentro de `src/app`.
- [ ] Unificar componentes visuales administrativos sobre primitivas oficiales.
- [ ] Definir caché e invalidación para endpoints públicos.
- [ ] Medir consultas lentas, tamaño de respuestas y crecimiento de tablas históricas.
- [ ] Revisar y retirar RPC históricas `SECURITY DEFINER` expuestas cuando exista un wrapper seguro equivalente.

## Fuera de alcance inmediato

- Reescritura visual completa sin necesidad funcional.
- Sustitución del motor canónico por modelos paralelos.
- Aplicación automática de importaciones sin revisión.
- Analítica no esencial antes de definir consentimiento y privacidad.

## Criterio de cierre de una iniciativa

- Implementación y migración versionadas.
- Autorización, RLS y privacidad revisadas.
- Pruebas proporcionales al riesgo.
- Typecheck y build correctos.
- Documentación vigente actualizada.
- Recorrido funcional verificado en el entorno objetivo.
