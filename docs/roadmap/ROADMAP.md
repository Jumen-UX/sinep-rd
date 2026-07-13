# Hoja de ruta de SINEP RD

> Estado: vigente  
> Actualizada: 2026-07-13  
> Regla: validar cada punto contra código, migraciones y pruebas antes de iniciarlo

## Estado consolidado

La base cuenta con registro canónico de personas, dimensiones clericales, estructura configurable, permisos por jurisdicción, auditoría, revisión de incompatibilidades, portal público y CI con typecheck, pruebas y build.

La importación controlada persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección por fila y exige una decisión editorial explícita. Los lotes aprobados de personas, estructuras, nombramientos y eventos históricos cuentan con contratos transaccionales, auditoría por fila, registro en `import_batch_changes` y repetición idempotente. Los eventos importados se crean en `pending_review`, generan su plan de acciones y no modifican automáticamente el estado estructural vigente. Las coincidencias exactas de estructuras, nombramientos y eventos pueden enlazarse como operaciones `noop` sin mutar registros canónicos.

El piloto real de eventos ya verificó creación canónica, corrección en línea, revalidación, aprobación, aplicación y una segunda aplicación `noop` sin duplicar el evento. El dispatcher y el contrato mixto soportan lotes `create + noop` en una única operación transaccional. La interfaz distingue `create`, `update` y `noop`, usa acciones de aplicación según el dominio y separa columnas obligatorias de campos opcionales de plantilla.

## Prioridad 0 — operación segura

- [ ] Aplicar y verificar en cada entorno todas las migraciones pendientes. Las migraciones de importación están aplicadas y verificadas en el proyecto Supabase conectado.
- [ ] Ejecutar pruebas de integración contra una instancia no productiva de Supabase.
- [ ] Realizar smoke test autenticado de las rutas administrativas críticas. Preparación, corrección, revalidación, aprobación y aplicación de los cuatro dominios tienen smoke test autenticado por RPC. La aplicación `noop` también fue verificada con repetición idempotente.
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
- Aplicación de lotes de personas, estructuras, nombramientos y eventos mediante `imports.apply`.
- Creación atómica mediante los motores canónicos de personas, estructuras, cargos y eventos.
- Eventos importados en `pending_review`, con plan de acciones y sin mutación estructural automática.
- Enlace `noop` para coincidencias exactas y únicas de estructuras, nombramientos y eventos.
- Lotes mixtos `create + noop` dentro de una única operación transaccional.
- Reversión transaccional completa ante el fallo de cualquier fila.
- Protección contra doble aplicación mediante respuesta idempotente.
- Auditoría y trazabilidad entre fila, registro creado o enlazado, cambio aplicado y auditoría.
- Fixtures reproducibles del piloto de eventos y su corrección.
- Suite Playwright/Axe manual, versionada y separada de `pnpm check`.
- Reporte final CSV de lotes aplicados con hash, resumen de aplicación, operación y objetivo canónico por fila.

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
- [x] Implementar registro transaccional e idempotente de eventos históricos.
- [x] Mantener los eventos importados en revisión y bloquear efectos estructurales automáticos.
- [x] Detectar coincidencias exactas y únicas de estructuras, nombramientos y eventos.
- [x] Aplicar lotes completamente `noop` sin modificar registros canónicos.
- [x] Registrar operaciones `noop` en `import_batch_changes` y en auditoría.
- [x] Permitir lotes mixtos `create + noop` dentro de una única transacción.
- [x] Impedir doble aplicación y revertir todo el intento cuando falla una fila.
- [x] Añadir soporte visual y contractual para operaciones `update`.
- [x] Separar columnas obligatorias de columnas opcionales de plantilla.
- [x] Usar acciones de aplicación dinámicas según el dominio.
- [x] Añadir reporte final descargable para lotes aplicados.
- [x] Añadir suite E2E manual del portal público, accesibilidad y preparación administrativa de importaciones.

### Pendiente — orden de ejecución

1. [ ] Completar operaciones `update` con comparación visible de cambios y aprobación explícita para todos los dominios que deban admitir actualización.
2. [ ] Añadir un identificador estable para habilitar `noop` seguro en personas.
3. [ ] Añadir lectura XLSX después de evaluar dependencia, límites y seguridad.
4. [ ] Ampliar E2E al recorrido autenticado preparar → corregir → aprobar → aplicar en un entorno no productivo.
5. [ ] Ejecutar `pnpm check` y el navegador real cuando el entorno de CI/despliegue vuelva a estar disponible.

## Prioridad 2 — calidad del producto

- [x] Añadir base E2E de portal público y flujo administrativo de importación.
- [x] Automatizar WCAG con Axe y recorridos básicos de teclado.
- [x] Añadir metadata dinámica para fichas públicas y URLs canónicas.
- [ ] Ampliar pruebas E2E a login y flujos administrativos críticos.
- [ ] Incorporar Lighthouse/Core Web Vitals en una compuerta medible.
- [ ] Probar navegación móvil real y tablas adaptativas.
- [ ] Optimizar imágenes remotas con una política explícita.

## Prioridad 3 — mantenibilidad y rendimiento

- [ ] Consolidar servicios y selectores jerárquicos que todavía tienen variantes heredadas.
- [ ] Reducir páginas con lógica de dominio dentro de `src/app`.
- [ ] Unificar componentes visuales administrativos sobre primitivas oficiales.
- [ ] Completar la estrategia de caché e invalidación para endpoints públicos.
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
