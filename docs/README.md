Exit code: 0
Wall time: 0.3 seconds
Output:
# Documentación de SINEP RD

Este índice reúne únicamente documentación funcional y vigente. Antes de implementar un cambio, consulta la sección correspondiente.

## Inicio rápido

| Necesidad | Documento |
|---|---|
| Entender el sistema | [Arquitectura](./architecture/ARQUITECTURA.md) |
| Crear o mover módulos | [Convención de módulos](./architecture/CONVENCION_MODULOS.md) |
| Implementar o modificar estructuras | [Modelo estructural canónico](./SPRINT_2_CANONICAL_STRUCTURE_MODEL.md) y [mapa de contratos](./architecture/CONTRATOS_MODELO_ESTRUCTURAL.md) |
| Revisar compatibilidad estructural heredada | [Inventario de compatibilidad](./SPRINT_2_LEGACY_COMPATIBILITY_INVENTORY.md) |
| Consultar el cierre técnico del Sprint 2 | [Acta de cierre del Sprint 2](./SPRINT_2_CIERRE.md) |
| Consultar el trabajo activo del Sprint 3 | [Backlog de autenticación, acceso y onboarding](./SPRINT_3_BACKLOG.md) |
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
- [Modelo estructural canónico](./SPRINT_2_CANONICAL_STRUCTURE_MODEL.md): fuentes de verdad y separación entre identidad, territorio, organización y nombramientos.
- [Contratos del modelo estructural](./architecture/CONTRATOS_MODELO_ESTRUCTURAL.md): lecturas, escrituras, auditoría, publicación, invalidación y pruebas obligatorias.
- [Inventario de compatibilidad estructural](./SPRINT_2_LEGACY_COMPATIBILITY_INVENTORY.md): contratos retirados, compatibilidades temporales y condiciones para eliminación futura.
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
- [Acta de cierre técnico del Sprint 2](./SPRINT_2_CIERRE.md): evidencia de CI, criterios cumplidos y pendientes operativos de beta.
- [Sprint 3 — autenticación, acceso y onboarding](./SPRINT_3_BACKLOG.md): bloques activos, reglas y criterios de cierre.
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

