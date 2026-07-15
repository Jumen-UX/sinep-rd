# Documentación de SINEP RD

> Estado: vigente
> Última revisión: 2026-07-15

Este índice apunta a documentación canónica y activa. Los cierres y resultados históricos se conservan bajo `archive` y no definen el estado actual.

## Inicio rápido

| Necesidad | Documento |
|---|---|
| Entender el propósito del sistema | [Plan Maestro](./product/PLAN_MAESTRO.md) |
| Consultar prioridades y estado | [Hoja de ruta](./product/ROADMAP.md) |
| Continuar el sprint activo | [Sprint 4](./sprints/active/sprint-4.md) |
| Entender la arquitectura | [Arquitectura](./architecture/ARQUITECTURA.md) |
| Crear o mover módulos | [Convención de módulos](./architecture/CONVENCION_MODULOS.md) |
| Implementar estructuras | [Modelo estructural canónico](./architecture/MODELO_ESTRUCTURAL_CANONICO.md) |
| Revisar compatibilidad estructural | [Deprecaciones estructurales](./architecture/DEPRECACIONES_ESTRUCTURALES.md) |
| Cambiar PostgreSQL o Supabase | [Reglas de base de datos](./architecture/REGLAS_BASE_DATOS.md) |
| Revisar privacidad o RLS | [Seguridad de datos](./architecture/SEGURIDAD_DATOS.md) |
| Revisar permisos, alcance o auditoría | [Autorización y auditoría](./architecture/AUTORIZACION_Y_AUDITORIA.md) |
| Confirmar tecnologías | [Stack oficial](./architecture/STACK_OFICIAL.md) |
| Crear o rediseñar una pantalla | [Sistema de diseño](./design/SISTEMA_DE_DISENO.md) y [Estándares web](./standards/ESTANDARES_WEB_SINEP_RD.md) |
| Planificar UX | [UX](./product/UX.md) y [backlog UX activo](./sprints/active/ux-backlog.md) |
| Registrar o validar una fuente | [Fuentes del proyecto](./standards/FUENTES_DEL_PROYECTO.md) |
| Operar acceso administrativo | [Acceso administrativo](./operations/ACCESO_ADMINISTRATIVO.md) |
| Ejecutar E2E o accesibilidad | [E2E y accesibilidad](./testing/E2E_Y_ACCESIBILIDAD.md) |

## Documentación vigente

### Producto

- [Plan Maestro](./product/PLAN_MAESTRO.md).
- [Hoja de ruta](./product/ROADMAP.md).
- [UX](./product/UX.md).

### Arquitectura y seguridad

- [Arquitectura](./architecture/ARQUITECTURA.md).
- [Convención de módulos](./architecture/CONVENCION_MODULOS.md).
- [Modelo estructural canónico](./architecture/MODELO_ESTRUCTURAL_CANONICO.md).
- [Deprecaciones estructurales](./architecture/DEPRECACIONES_ESTRUCTURALES.md).
- [Reglas de base de datos](./architecture/REGLAS_BASE_DATOS.md).
- [Seguridad de datos](./architecture/SEGURIDAD_DATOS.md).
- [Autorización y auditoría](./architecture/AUTORIZACION_Y_AUDITORIA.md).
- [Stack oficial](./architecture/STACK_OFICIAL.md).

### Interfaz y estándares

- [Sistema de diseño](./design/SISTEMA_DE_DISENO.md).
- [Parámetros de interfaz](./design/SINEP_UI_PARAMETERS.json).
- [Estándares web](./standards/ESTANDARES_WEB_SINEP_RD.md).
- [Fuentes del proyecto](./standards/FUENTES_DEL_PROYECTO.md).

### Operación y pruebas

- [Acceso administrativo](./operations/ACCESO_ADMINISTRATIVO.md).
- [Operación y recuperación](./OPERACION_Y_RECUPERACION.md).
- [E2E y accesibilidad](./testing/E2E_Y_ACCESIBILIDAD.md).

### Trabajo activo

- [Sprint 4](./sprints/active/sprint-4.md).
- [Auditoría de flujos de personas](./sprints/active/sprint-4-person-flows-audit.md).
- [Backlog UX](./sprints/active/ux-backlog.md).

## Archivo histórico

Los cierres y evidencias de sprints terminados están en [`archive/sprints`](./archive/sprints/). Su contenido puede incluir conteos o estados superados posteriormente y debe interpretarse según su fecha.

## Jerarquía de autoridad

Cuando dos documentos discrepen:

1. migraciones, código y pruebas actuales;
2. normas vigentes bajo `architecture` y `standards`;
3. Plan Maestro y hoja de ruta vigente;
4. UX y sistema de diseño;
5. documentación activa del sprint;
6. archivo histórico.

Una discrepancia entre código y norma vigente debe resolverse; no se considera automáticamente válida por estar implementada.

## Mantenimiento

- Todo documento normativo o activo debe declarar estado y fecha de revisión.
- Solo existe una hoja de ruta vigente.
- Solo un sprint funcional aparece como activo.
- Los resultados puntuales se archivan al cerrar el sprint.
- No crear archivos `COMPLETE`, `FINAL` o `SUMMARY` en la raíz de `docs`.
- Actualizar este índice al añadir o sustituir una referencia vigente.
- Usar enlaces relativos y comprobarlos antes de cerrar el cambio.
