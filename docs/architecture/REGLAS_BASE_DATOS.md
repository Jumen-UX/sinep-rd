# Reglas de base de datos

> Estado: norma vigente  
> Última revisión: 2026-07-10  
> Fuente ejecutable: `supabase/migrations`

## Principios

- La base conserva identidad, historia, fuente y vigencia.
- Las reglas críticas se defienden en PostgreSQL, no solo en la interfaz.
- Toda modificación del esquema se entrega mediante una migración nueva.
- Las operaciones compuestas se ejecutan mediante RPC transaccionales.
- Las lecturas públicas usan contratos estrechos y explícitos.

## Migraciones

- Nombre: `YYYYMMDDHHMMSS_descripcion.sql` cuando sea posible.
- No editar una migración ya aplicada en un entorno compartido; crear una corrección posterior.
- Incluir revocaciones y concesiones explícitas para funciones nuevas.
- Añadir índices para claves foráneas y filtros frecuentes.
- Documentar compatibilidad temporal cuando convivan modelos legado y canónico.

## Fechas, vigencia e historia

- Fecha completa: `YYYY-MM-DD`.
- Instantes técnicos: `timestamptz`.
- Un hecho cambiante se modela como evento o registro con inicio/fin.
- Una fecha desconocida permanece nula y puede acompañarse de precisión o nota; nunca se inventa.
- `is_current` debe ser coherente con fechas y estado mediante restricciones, triggers o escritores canónicos.

## Identidad y dimensiones personales

- Una persona tiene una sola identidad base.
- Ordenaciones, estado clerical, función episcopal, dignidades y vida religiosa son dimensiones distintas.
- Los grados del Orden son acumulativos y cronológicos.
- Los flujos de transición reutilizan la persona existente.
- Antes de crear se consulta el motor de similitud; la coincidencia requiere revisión explícita.

## Catálogos

- Usar ISO u otra fuente oficial cuando exista.
- Los catálogos internos necesitan clave estable, nombre, estado y trazabilidad.
- Las referencias guardan identificadores, no etiquetas copiadas.
- Evitar enums nuevos cuando el dominio necesita crecer editorialmente; justificar cada elección.

## Estructura eclesial

La jerarquía interna se modela mediante:

- Plantilla.
- Nivel configurable.
- Nodo.
- Relación padre-hijo.
- Entidad vinculada.
- Vigencia y evento histórico.

No añadir columnas jerárquicas fijas para resolver una necesidad local.

## Cargos y nombramientos

Un nombramiento vincula persona opcional, cargo, ámbito, fechas, estado y fuente. Las reglas canónicas incluyen:

- Elegibilidad por grado, función y estado.
- Cardinalidad de titulares.
- Cierre controlado de asignaciones reemplazadas.
- Protección contra dos asignaciones actuales incompatibles.
- Cola de revisión cuando una regla cambia y afecta datos vigentes.

Las escrituras deben pasar por el escritor canónico; no insertar directamente desde la aplicación.

## Seguridad SQL

- Activar RLS en tablas expuestas.
- Definir políticas por operación y rol.
- Las funciones `security definer` fijan `search_path` y validan autorización.
- Revocar privilegios por defecto que amplíen acceso.
- Las vistas públicas no incluyen columnas privadas y usan `security_invoker` cuando sea adecuado.
- La service role se reserva para servidor, migraciones y pruebas controladas.

## Rendimiento

- Indexar claves foráneas usadas en joins.
- Indexar filtros por estado, visibilidad, slug, vigencia y alcance.
- Evitar consultas públicas sin límite.
- Revisar planes de ejecución antes de añadir índices especulativos.
- Medir payloads y consultas lentas en producción.

## Fuentes y auditoría

Los datos históricos o institucionales deben admitir fuente, documento o nota. Las operaciones administrativas sensibles deben registrar actor, acción, objetivo y alcance sin duplicar contenido privado.

## Checklist de migración

- [ ] Es aditiva o explica su estrategia de transición.
- [ ] Preserva datos existentes.
- [ ] Define constraints e índices necesarios.
- [ ] Revisa RLS, grants y `search_path`.
- [ ] Mantiene compatibilidad de API cuando corresponde.
- [ ] Incluye prueba contractual o de integración.
- [ ] Se ejecuta en orden limpio desde el historial de migraciones.

## Referencias

- [Arquitectura](./ARQUITECTURA.md)
- [Seguridad de datos](./SEGURIDAD_DATOS.md)
