# Documentación de SINEP RD

Este índice reúne únicamente documentación funcional y vigente. Antes de implementar un cambio, consulta la sección correspondiente.

## Inicio rápido

| Necesidad | Documento |
|---|---|
| Entender el sistema | [Arquitectura](./architecture/ARQUITECTURA.md) |
| Crear o mover módulos | [Convención de módulos](./architecture/CONVENCION_MODULOS.md) |
| Cambiar PostgreSQL o Supabase | [Reglas de base de datos](./architecture/REGLAS_BASE_DATOS.md) |
| Revisar permisos o privacidad | [Seguridad de datos](./architecture/SEGURIDAD_DATOS.md) |
| Confirmar tecnologías | [Stack oficial](./architecture/STACK_OFICIAL.md) |
| Crear una pantalla | [Estándares web](./standards/ESTANDARES_WEB_SINEP_RD.md), [guía de interfaz](./design/SINEP_UI_SKILL.md) y [Plan UX](./PLAN_UX.md) |
| Planificar o validar experiencia de usuario | [Plan UX](./PLAN_UX.md) |
| Registrar o validar una fuente | [Fuentes del proyecto](./standards/FUENTES_DEL_PROYECTO.md) |
| Consultar prioridades | [Hoja de ruta](./roadmap/ROADMAP.md) |

## Documentación vigente

### Arquitectura y desarrollo

- [Arquitectura](./architecture/ARQUITECTURA.md): capas, dominios y decisiones obligatorias.
- [Convención de módulos](./architecture/CONVENCION_MODULOS.md): ubicación y responsabilidad de archivos.
- [Reglas de base de datos](./architecture/REGLAS_BASE_DATOS.md): migraciones, integridad, historia y rendimiento.
- [Seguridad de datos](./architecture/SEGURIDAD_DATOS.md): clasificación, autorización, RLS y operación segura.
- [Stack oficial](./architecture/STACK_OFICIAL.md): tecnologías y comandos aceptados.

### Interfaz, experiencia y marca

- [Plan UX](./PLAN_UX.md): fases, prioridades, criterios de aceptación, modo oscuro, accesibilidad y validación con usuarios.
- [Guía de interfaz](./design/SINEP_UI_SKILL.md).
- [Parámetros de interfaz](./design/SINEP_UI_PARAMETERS.json).
- [Perfil visual institucional](./design/PERFIL_VISUAL_ARQUIDIOCESIS_SANTO_DOMINGO.md).
- [Estándares web obligatorios](./standards/ESTANDARES_WEB_SINEP_RD.md).
- [Fuentes del proyecto](./standards/FUENTES_DEL_PROYECTO.md): autoridad, trazabilidad, discrepancias y publicación.

### Planificación

- [Hoja de ruta vigente](./roadmap/ROADMAP.md).
- [Plan UX vigente](./PLAN_UX.md).

## Jerarquía de autoridad

Cuando dos documentos discrepen, aplicar este orden:

1. Migraciones, código y pruebas actuales.
2. Normas vigentes bajo `architecture` y `standards`.
3. Hoja de ruta vigente.
4. Plan UX y documentación de diseño.

Una discrepancia entre código y norma vigente debe resolverse: no se considera automáticamente válida por estar implementada.

## Mantenimiento

- Añadir estado y fecha de revisión a documentos normativos.
- Eliminar planes completados o sustituidos después de trasladar cualquier decisión todavía vigente.
- No crear archivos `COMPLETE`, `FINAL` o `SUMMARY` en la raíz de `docs`.
- Actualizar este índice al añadir una referencia vigente.
- Usar enlaces relativos y comprobarlos antes de cerrar el cambio.