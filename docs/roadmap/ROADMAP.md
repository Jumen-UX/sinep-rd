# Hoja de ruta de SINEP RD

> Estado: vigente  
> Actualizada: 2026-07-11  
> Regla: validar cada punto contra código, migraciones y pruebas antes de iniciarlo

## Estado consolidado

La base cuenta con registro canónico de personas, dimensiones clericales, estructura configurable, permisos por jurisdicción, auditoría, revisión de incompatibilidades, portal público y CI con typecheck, pruebas y build.

La importación controlada persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección por fila y exige una decisión editorial explícita. Los lotes aprobados de personas, estructuras y nombramientos ya pueden aplicarse con transacción integral, auditoría por fila, registro en `import_batch_changes` y repetición idempotente. Los eventos históricos continúan bloqueados hasta tener su propio contrato seguro.

## Prioridad 0 — operación segura

- [ ] Aplicar y verificar en cada entorno todas las migraciones pendientes. Las migraciones de importación están aplicadas y verificadas en el proyecto Supabase conectado.
- [ ] Ejecutar pruebas de integración contra una instancia no productiva de Supabase.
- [ ] Realizar smoke test autenticado de las rutas administrativas críticas. Preparación, corrección, revalidación, aprobación y aplicación de personas, estructuras y nombramientos ya tienen smoke test autenticado por RPC.
- [ ] Confirmar protección contra contraseñas filtradas y revisar asesores de seguridad de Supabase. Los asesores fueron revisados; la protección contra contraseñas filtradas continúa pendiente de activación.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal.

## Prioridad 1 — importación controlada

Disponible actualmente:

- Plantillas CSV, lectura local, hash SHA-256 y vista previa limitada.
- Persistencia de lotes, filas e incidencias con RLS por alcance.
- Validación de campos, catálogos, fechas, duplicados y relaciones.
- Historial de lotes, detalle por fila, corrección y revalidación.
- Aprobación o rechazo mediante el permiso `imports.review`.
- Reinicio automático de la aprobación cuando el lote vuelve a validarse.
- Aplicación de lotes de personas, estructuras y nombramientos mediante `imports.apply`.
- Validación de elegibilidad, cardinalidad y vigencia de nombramientos.
- Creación atómica mediante los motores canónicos de personas, estructuras y cargos.
- Reversión transaccional completa ante el fallo de cualquier fila.
- Protección contra doble aplicación mediante respuesta idempotente.
- Auditoría y trazabilidad entre fila, registro creado, cambio aplicado y auditoría.

### Completado

- [x] Crear tablas de lote, filas, incidencias y cambios aplicados.
- [x] Implementar RPC de preparación y validación transaccional.
- [x] Validar catálogos, relaciones, alcance y duplicados por fila.
- [x] Permitir corrección y reintento del lote sin modificar registros canónicos.
- [x] Añadir historial, detalle e incidencias accesibles según el alcance administrativo.
- [x] Añadir revisión editorial explícita, separada de la aplicación canónica.
- [x] Invalidar automáticamente una aprobación anterior cuando cambian los datos validados.
- [x] Implementar aplicación transaccional e idempotente para lotes de personas.
- [x] Implementar aplicación transaccional e idempotente para parroquias y estructuras.
- [x] Implementar aplicación transaccional e idempotente para cargos y nombramientos.
- [x] Reutilizar elegibilidad, titular único, cardinalidad y cierre de nombramientos incompatibles.
- [x] Registrar cada creación en `import_batch_changes` y enlazar su auditoría.
- [x] Impedir doble aplicación y revertir todo el intento cuando falla una fila.

### Pendiente

- [ ] Implementar contrato de aplicación para eventos históricos.
- [ ] Definir operaciones `update` y `noop` para archivos que enlacen registros canónicos existentes.
- [ ] Añadir reporte final descargable del lote aplicado.
- [ ] Añadir lectura XLSX después de evaluar dependencia, límites y seguridad.
- [ ] Añadir pruebas E2E del recorrido preparar → corregir → aprobar → aplicar.

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
