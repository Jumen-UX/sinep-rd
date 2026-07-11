# Hoja de ruta de SINEP RD

> Estado: vigente  
> Actualizada: 2026-07-10  
> Regla: validar cada punto contra código, migraciones y pruebas antes de iniciarlo

## Estado consolidado

La base cuenta con registro canónico de personas, dimensiones clericales, estructura configurable, permisos por jurisdicción, auditoría, revisión de incompatibilidades, portal público y CI con typecheck, pruebas y build.

## Prioridad 0 — operación segura

- [ ] Aplicar y verificar en cada entorno todas las migraciones pendientes.
- [ ] Ejecutar pruebas de integración contra una instancia no productiva de Supabase.
- [ ] Realizar smoke test autenticado de las rutas administrativas críticas.
- [ ] Confirmar protección contra contraseñas filtradas y revisar asesores de seguridad de Supabase.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal.

## Prioridad 1 — importación controlada

Disponible actualmente: plantillas CSV, lectura local, validación de encabezados y vista previa limitada.

- [ ] Crear tablas de lote y filas con estado, errores y actor.
- [ ] Diseñar RPC de preparación, validación y aplicación transaccional.
- [ ] Validar catálogos, relaciones, alcance y duplicados por fila.
- [ ] Permitir corrección y reintento sin duplicar registros ya aplicados.
- [ ] Añadir lectura XLSX después de evaluar dependencia, límites y seguridad.
- [ ] Auditar cada aplicación y conservar resumen del archivo, no datos privados innecesarios.

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
