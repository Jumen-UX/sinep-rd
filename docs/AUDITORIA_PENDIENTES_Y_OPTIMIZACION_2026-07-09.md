# Auditoría de pendientes y optimización — SINEP RD

Fecha: 2026-07-09

> Nota de actualización (2026-07-10): esta auditoría conserva el estado observado el 9 de julio. Varias tareas de seguridad, permisos granulares, arquitectura por dominios y contratos canónicos fueron implementadas posteriormente. Para decidir trabajo nuevo se debe contrastar cada pendiente con las migraciones y pruebas actuales; no asumir que toda casilla abierta continúa vigente.

## Estado general

La reorganización hacia grupos de rutas `(admin)` y `(public)` conserva las URLs y la mayoría de los módulos. El repositorio ya tiene una base más clara, pero todavía mezcla composición de rutas, lógica de pantalla, estilos extensos y acceso a datos en algunos archivos de `src/app`.

## Correcciones críticas

- [x] Restaurar validación robusta de roles administrativos en `src/middleware.ts`.
- [x] Aplicar la misma validación robusta en `src/lib/admin/authorization.ts`.
- [ ] Ejecutar `pnpm check` en CI y corregir cualquier error después de la reorganización.
- [ ] Probar navegación real de las rutas administrativas críticas después del próximo despliegue.

## Pendientes funcionales

### Personas y sacerdotes

- [x] Directorio administrativo de personas.
- [x] Ficha administrativa por secciones.
- [x] Propuestas de edición sujetas a revisión.
- [x] Asistente de sacerdote de cinco etapas.
- [ ] Detector de posibles duplicados antes de crear una persona.
- [ ] Mover la actualización de datos religiosos al RPC transaccional `admin_save_priest`.
- [ ] Evitar fotografías huérfanas cuando falle el guardado del sacerdote.
- [ ] Convertir estado canónico, instituto religioso y país del documento en selectores de catálogo.
- [ ] Añadir historial visible de ordenaciones, incardinaciones y cambios canónicos.
- [ ] Corregir el enlace público de la ficha administrativa para usar siempre el slug público.

### Carga por lotes

- [x] Pantalla administrativa y selección de tipo de importación.
- [x] Validación inicial de extensión y tamaño.
- [ ] Descargar plantillas oficiales CSV/XLSX.
- [ ] Leer y previsualizar filas.
- [ ] Validar catálogos, relaciones y duplicados.
- [ ] Crear una tabla de lotes y filas de importación.
- [ ] Aplicar lotes en una transacción o cola controlada.
- [ ] Mostrar errores por fila y permitir reintentos.

### Estructura eclesial

- [x] Estructura flexible por jurisdicción.
- [x] Selector jerárquico existente.
- [ ] Sustituir filtros basados en expresiones regulares por `entity_types` en módulos restantes.
- [ ] Consolidar un selector jerárquico universal reutilizable.
- [ ] Revisar desmembramientos, fusiones, divisiones y supresiones como eventos históricos.
- [ ] Validar que todos los enlaces de jurisdicciones y entidades abran su ficha correspondiente.

### Portal público y seguridad de lectura

- [ ] Revisar permisos `anon` de vistas y tablas usadas por el dashboard público.
- [ ] Eliminar errores 401 de fuentes públicas opcionales.
- [ ] Resolver advertencias del linter sobre vistas `SECURITY DEFINER`.
- [ ] Definir una estrategia única: vistas `security_invoker`, RPC públicas controladas o tablas de publicación.
- [ ] Revisar que datos privados nunca queden expuestos mediante vistas públicas.

### Caché e indexación

- [ ] Definir caché por endpoint público.
- [ ] Añadir invalidación al publicar cambios.
- [ ] Revisar índices de búsquedas por slug, estado, visibilidad, jerarquía y asignaciones actuales.
- [ ] Añadir métricas de consultas lentas y tamaño de respuestas.

## Optimización de la estructura del repositorio

### Problemas actuales

1. `src/app/(admin)/admin/layout.tsx` contiene una hoja de estilos extensa embebida.
2. Varias páginas administrativas mantienen lógica de datos y UI completa dentro de `page.tsx`.
3. El framework administrativo está dividido entre CSS global embebido y `src/app/admin-framework.css`.
4. Las rutas públicas ya migraron parcialmente a `src/features`, pero administración todavía no.
5. Algunas APIs comparten autorización y validación, pero todavía existen patrones antiguos en módulos no migrados.

### Estructura objetivo recomendada

```text
src/
  app/
    (admin)/admin/          # rutas y composición mínima
    (public)/               # rutas públicas y composición mínima
    api/                    # adaptadores HTTP
  features/
    admin-shell/
    personas/
    clero/
    asignaciones/
    jurisdicciones/
    estructura/
    importaciones/
    eventos/
  components/
    admin/                  # componentes visuales realmente transversales
    ui/
    shared/
  lib/
    admin/                  # autorización, auditoría y errores
    catalogs/
    supabase/
    validation/
  styles/
    admin-shell.css
    admin-framework.css
    globals.css
```

### Orden de optimización

1. Mover el CSS embebido del layout a `src/styles/admin-shell.css`.
2. Importar `admin-framework.css` una sola vez desde el layout administrativo.
3. Extraer `PersonListPage`, `PersonDetailPage` y `PriestWizard` hacia `src/features/personas` y `src/features/clero`.
4. Dejar cada `page.tsx` como exportación/composición de menos de 30 líneas.
5. Crear servicios tipados por dominio para RPC y consultas Supabase.
6. Unificar catálogos y selectores en `src/lib/catalogs` y `src/components/admin`.
7. Añadir pruebas para autorización, creación de sacerdote, asignaciones incompatibles e importaciones.

## Rutas de aceptación para la siguiente validación

- `/admin`
- `/admin/personas`
- `/admin/personas/[id]`
- `/admin/personas/[id]/editar`
- `/admin/nuevo/sacerdote`
- `/admin/importar`
- `/admin/jurisdicciones`
- `/admin/estructura`
- `/admin/paises`
- `/admin/asignaciones`
- `/admin/eventos`
- `/admin/revision`

## Próxima fase recomendada

1. Estabilización técnica: CI, navegación y autorización.
2. Extracción del CSS y del framework administrativo.
3. Finalización del ciclo Persona → Sacerdote → Ficha → Edición → Historial.
4. Implementación real de carga por lotes.
5. Seguridad y rendimiento del portal público.
