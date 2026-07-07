# Arquitectura base — SINEP RD

SINEP RD no es solo un directorio. Es una plataforma para modelar personas, jurisdicciones, estructuras eclesiales, cargos, nombramientos, fuentes documentales y evolución histórica.

## Principio central

El sistema se construye sobre un motor flexible de estructuras.

Cada diócesis puede tener su propia organización:

```txt
Diócesis → Zona pastoral → Parroquia
```

```txt
Diócesis → Vicaría → Zona pastoral → Parroquia → Sector
```

```txt
Diócesis → Decanato → Parroquia → Comunidad
```

La aplicación no debe asumir una jerarquía universal fija.

## Capas del sistema

```txt
Interfaz web
  ↓
Servicios de aplicación / Server Actions / API routes
  ↓
RPC públicas controladas / consultas tipadas
  ↓
RLS + funciones internas de seguridad
  ↓
Tablas canónicas, estructuras, personas, cargos, eventos y documentos
```

## Frontend

Responsabilidades:

- Renderizar dashboards.
- Mostrar formularios dinámicos.
- Consumir selectores jerárquicos.
- Validar campos básicos.
- Evitar entrada manual innecesaria.
- Mostrar estados de carga, error y vacío.
- No duplicar reglas críticas de base de datos.

El frontend debe leer la estructura activa de cada diócesis desde Supabase.

## Base de datos

Responsabilidades:

- Guardar la verdad canónica y pastoral.
- Proteger datos con RLS.
- Separar datos públicos de datos privados.
- Mantener historial y vigencia.
- Validar relaciones jerárquicas.
- Registrar fuentes documentales.
- Registrar eventos de evolución.

## Motor flexible de estructuras

El motor debe basarse en estas ideas:

| Concepto | Descripción |
|---|---|
| `structure_templates` | Estructura configurada para una diócesis o jurisdicción. |
| `structure_kinds` | Tipo de estructura: territorial, pastoral, administrativa, orgánica o mixta. |
| `structure_levels` | Niveles de una estructura: vicaría, zona, parroquia, sector, etc. |
| `structure_level_edges` | Relaciones permitidas entre niveles. |
| `structure_nodes` | Nodos reales: Vicaría Norte, Zona Sur, Parroquia X. |
| `structure_node_edges` | Relaciones históricas entre nodos. |
| `structure_events` | Eventos de creación, división, fusión, supresión o reorganización. |
| `structure_level_office_configurations` | Cargos permitidos por nivel. |

## Selectores dinámicos

Todos los formularios que dependan de ubicación eclesial deben usar el mismo patrón:

```txt
1. Seleccionar diócesis.
2. Cargar estructura activa.
3. Mostrar niveles configurados.
4. Cargar opciones por nivel y padre seleccionado.
5. Permitir crear nodo nuevo solo si el nivel lo permite.
```

Ejemplo:

```txt
Diócesis seleccionada: La Vega
Estructura activa: Territorial-pastoral
Niveles visibles:
- Zona pastoral
- Parroquia
```

```txt
Diócesis seleccionada: Santo Domingo
Estructura activa: Territorial-pastoral
Niveles visibles:
- Vicaría
- Zona pastoral
- Parroquia
```

## Eventos históricos

Las modificaciones estructurales importantes no deben hacerse como edición silenciosa.

Deben modelarse como eventos:

- Creación.
- Erección.
- Desmembramiento.
- División.
- Fusión.
- Reorganización.
- Supresión.
- Cambio de nombre.
- Cambio de límites.
- Cambio de dependencia.
- Cambio de nivel.

Cada evento debe tener:

- Fecha efectiva.
- Fecha de registro.
- Usuario responsable.
- Fuente documental.
- Motivo.
- Nodos origen.
- Nodos destino.
- Estado de aprobación.

## Cargos y nombramientos

Los cargos deben filtrarse por el nivel seleccionado.

Ejemplos:

| Nivel | Cargos posibles |
|---|---|
| Diócesis | Obispo diocesano, vicario general, canciller, ecónomo. |
| Vicaría | Vicario episcopal, coordinador pastoral. |
| Parroquia | Párroco, administrador parroquial, vicario parroquial, diácono adscrito. |
| Sector | Coordinador de sector, responsable pastoral. |

## Organigramas

Los organigramas no se dibujan manualmente.

Deben generarse desde:

- Estructura activa.
- Nodos vigentes.
- Cargos permitidos.
- Nombramientos actuales.
- Vigencia histórica.

## Dashboard

El dashboard debe permitir filtros independientes y jerárquicos:

- País.
- Provincia eclesiástica.
- Diócesis.
- Estructura activa.
- Nivel dinámico.
- Nodo.
- Parroquia.
- Cargo.
- Persona.
- Estado.
- Fecha histórica.

## Regla de no duplicación

No crear tablas paralelas para resolver lo que ya resuelve el motor de estructuras.

Antes de crear una tabla nueva, verificar si el concepto pertenece a:

- `structure_templates`
- `structure_levels`
- `structure_nodes`
- `structure_events`
- `ecclesiastical_entities`
- `pastoral_entities`
- `office_configurations`
- `position_assignments`
- `documents`
