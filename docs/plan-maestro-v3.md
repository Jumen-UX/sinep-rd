# Plan Maestro v3 — SINEP RD

**Fecha:** 1 de agosto de 2026  
**Repositorio:** `Jumen-UX/sinep-rd`  
**Rama operativa:** `main`  
**Propósito:** dejar documentados los pendientes reales del dashboard eclesial contextual después de contrastar la conversación con el estado actual del proyecto.

---

## 1. Contexto de esta versión

Este Plan Maestro v3 no reemplaza todo el Plan Maestro v2. Lo complementa y actualiza en el área específica del **dashboard público, explorador eclesial, filtros jerárquicos, filtros independientes, organigramas y navegación histórica**.

La revisión confirmó que varios puntos que antes estaban pendientes ya fueron implementados o avanzados significativamente:

- Corrección visual del dashboard público.
- Separación de estilos principales del dashboard en `src/app/dashboard.css`.
- Explorador público base con filtros por país, provincia eclesiástica, jurisdicción y vista activa.
- Sincronización básica de filtros con parámetros de URL.
- Carga pública inicial optimizada por vista territorial.
- Carga diferida de vistas públicas más pesadas.
- Endpoints agregados de dashboard público: `/api/dashboard/vistas` y `/api/dashboard/resumen`.
- Uso de caché pública mediante `unstable_cache`.
- Vistas públicas separadas para territorial, clero, pastoral, administrativa y colegial.

Por tanto, el pendiente real ya no es “arreglar el home viejo”. El pendiente real es completar el **Dashboard Eclesiástico Jerárquico Contextual profundo**.

---

## 2. Estado actual confirmado

### 2.1 Cerrado o suficientemente avanzado

| Área | Estado |
|---|---|
| Corrección visual de tarjetas y listas | Cerrado |
| Ajuste de tercera columna en filas del dashboard | Cerrado |
| Consolidación principal de estilos de dashboard | Cerrado |
| Explorador público con país, provincia y jurisdicción | Implementado |
| Parámetros URL para `vista`, `pais`, `provincia` y `jurisdiccion` | Implementado |
| Carga pública de datos territoriales | Implementado |
| Carga diferida de vistas no territoriales | Implementado |
| Endpoints `/api/dashboard/vistas` y `/api/dashboard/resumen` | Implementado |
| Servicios públicos de dashboard con caché | Implementado |
| Separación visual del portal público moderno | Implementado |

### 2.2 Parcial o pendiente

| Área | Estado |
|---|---|
| Filtro por niveles internos configurados de cada diócesis | Pendiente parcial |
| Filtro por vicaría, zona, decanato, sector o equivalente local | Pendiente |
| Filtro por parroquia específica dentro del explorador principal | Pendiente parcial |
| Filtros independientes por cargo, tipo de persona, estado y completitud | Pendiente parcial |
| Filtro histórico por fecha | Pendiente |
| Endpoint contextual único `/api/dashboard/context` | Pendiente |
| RPC pública de contexto jerárquico completo | Pendiente |
| Breadcrumb contextual dinámico completo | Pendiente parcial |
| Panel público de fichas incompletas por contexto | Pendiente |
| Organigramas automáticos públicos desde estructuras, cargos y personas | Pendiente parcial |
| Vista de sucesión/incumbentes históricos dentro del contexto seleccionado | Pendiente parcial |

---

## 3. Decisión funcional v3

El dashboard público debe evolucionar desde un explorador por filtros básicos hacia un **explorador contextual eclesiástico**.

La regla funcional será:

> El usuario siempre está viendo un contexto eclesial activo y, dentro de ese contexto, puede aplicar filtros independientes por entidad, persona, cargo, estado, completitud y fecha histórica.

Ejemplos de contexto:

```text
Todos los países
País
Provincia eclesiástica
Arquidiócesis / diócesis
Vicaría / zona / decanato / sector configurado por esa diócesis
Parroquia
Capilla / comunidad
Organismo pastoral
Organismo administrativo
Organismo colegial
```

Ejemplos de filtros independientes:

```text
Tipo de entidad
Tipo de persona
Cargo / función
Estado canónico, pastoral o administrativo
Estado de completitud de ficha
Nivel pastoral
Fecha histórica
```

---

## 4. Alcance del Dashboard Eclesiástico Jerárquico Contextual

### 4.1 Objetivo

Permitir consultar la información eclesial desde una jerarquía flexible y real, sin imponer una estructura fija para todas las diócesis.

El dashboard debe poder responder preguntas como:

- ¿Cuántas provincias eclesiásticas hay en este país?
- ¿Cuántas arquidiócesis, diócesis, parroquias y capillas hay dentro de esta provincia eclesiástica?
- ¿Qué vicarías, zonas, decanatos o divisiones internas usa esta diócesis?
- ¿Cuántos obispos activos, eméritos o fallecidos corresponden a este contexto?
- ¿Cuántos sacerdotes activos, fallecidos, trasladados o sin ficha completa hay en esta diócesis?
- ¿Qué parroquias pertenecen a esta zona o decanato?
- ¿Qué cargos están vacantes en este contexto?
- ¿Cómo era esta estructura en una fecha histórica determinada?
- ¿Qué personas han ocupado históricamente un cargo dentro de esta entidad?

### 4.2 Principio técnico

El dashboard no debe depender solamente de filtros calculados en cliente a partir de listas grandes. Debe existir una capa de contexto que pueda devolver:

```text
contexto actual
breadcrumb
nodos hijos
nodos descendientes
métricas agregadas
resultados filtrados
organigrama disponible
fichas incompletas
estado histórico según fecha
```

---

## 5. Nueva épica v3: Dashboard contextual profundo

### Épica V3-DASH-01 — Contexto jerárquico público

**Objetivo:** crear una fuente única para consultar el contexto activo público.

#### Tareas

1. Diseñar contrato de respuesta para `/api/dashboard/context`.
2. Crear servicio público `loadPublicDashboardContext()`.
3. Crear RPC o consulta SQL que reciba:
   - `context_type`
   - `context_id`
   - `country`
   - `province`
   - `jurisdiction_id`
   - `node_id`
   - `as_of_date`
4. Devolver breadcrumb contextual.
5. Devolver hijos directos y descendientes relevantes.
6. Devolver métricas agregadas por tipo.
7. Devolver resultados filtrados iniciales.
8. Aplicar caché y tags de revalidación.

#### Criterio de cierre

- El frontend puede cambiar de país a provincia, diócesis, nivel interno o parroquia sin reconstruir manualmente todo desde listas globales.
- Cada contexto devuelve su breadcrumb y sus métricas.
- Los resultados son compartibles por URL.

---

### Épica V3-DASH-02 — Niveles internos configurados por diócesis

**Objetivo:** permitir que el explorador lea las estructuras reales configuradas para cada diócesis.

#### Tareas

1. Identificar la estructura activa de la diócesis seleccionada.
2. Exponer los niveles internos disponibles:
   - vicaría
   - zona pastoral
   - decanato
   - sector
   - comunidad
   - cualquier nivel configurado por esa diócesis
3. Crear selector dinámico de niveles internos.
4. Permitir seleccionar nodo interno.
5. Mostrar parroquias, capillas, comunidades, cargos y personas dentro de ese nodo.
6. Evitar asumir que todas las diócesis usan la misma jerarquía.

#### Criterio de cierre

- Una diócesis con estructura `Diócesis > Zona > Parroquia` muestra solo esos niveles.
- Una diócesis con estructura `Diócesis > Vicaría > Decanato > Parroquia` muestra esos niveles.
- El selector no ofrece niveles inexistentes en la diócesis seleccionada.

---

### Épica V3-DASH-03 — Filtros independientes completos

**Objetivo:** agregar filtros que funcionen dentro del contexto activo sin romper la jerarquía.

#### Tareas

1. Agregar filtro por tipo de entidad.
2. Agregar filtro por tipo de persona:
   - obispo
   - sacerdote
   - diácono
   - religioso/a
   - laico/a
3. Agregar filtro por cargo o función.
4. Agregar filtro por estado:
   - activo
   - emérito
   - fallecido
   - vacante
   - histórico
   - pendiente de validación
5. Agregar filtro por completitud:
   - ficha completa
   - ficha incompleta
   - datos no identificados
   - no aplica
   - pendiente de validar
6. Agregar filtro por nivel pastoral o administrativo.
7. Sincronizar todos los filtros con URL.
8. Permitir limpiar cada filtro individualmente.

#### Criterio de cierre

- El usuario puede consultar, por ejemplo: “sacerdotes activos con ficha incompleta en la Diócesis de La Vega”.
- Cada filtro queda reflejado en la URL.
- El estado mostrado incluye una frase clara de alcance, por ejemplo: `Mostrando sacerdotes activos con ficha incompleta en la Diócesis de La Vega`.

---

### Épica V3-DASH-04 — Navegación histórica por fecha

**Objetivo:** permitir consultar cómo era una estructura o asignación en una fecha pasada.

#### Tareas

1. Agregar parámetro `fecha` o `as_of_date` al dashboard.
2. Filtrar estructuras por vigencia.
3. Filtrar cargos y asignaciones por vigencia.
4. Mostrar aviso visible cuando el usuario esté en modo histórico.
5. Permitir regresar al estado actual.
6. Preparar compatibilidad con eventos estructurales históricos.

#### Criterio de cierre

- El usuario puede seleccionar una fecha y ver estructura, cargos y personas vigentes en esa fecha.
- La interfaz diferencia claramente “estado actual” de “estado histórico”.
- No se mezclan asignaciones actuales con históricas sin indicarlo.

---

### Épica V3-DASH-05 — Organigramas automáticos públicos

**Objetivo:** generar organigramas desde datos reales, no como gráficos manuales.

#### Tareas

1. Definir contrato de organigrama público.
2. Construir organigrama territorial desde estructura activa.
3. Construir organigrama pastoral desde `organization_charts` y `organization_units`.
4. Construir organigrama administrativo desde unidades y cargos.
5. Construir organigrama colegial desde organismos y miembros.
6. Asociar cargos y personas vigentes.
7. Mostrar vacantes cuando no haya titular.
8. Permitir navegar desde cada nodo hacia su ficha.
9. Soportar fecha histórica.

#### Criterio de cierre

- Cada organigrama se genera desde estructura, cargos y asignaciones.
- Cada nodo visible es navegable o explica por qué no tiene ficha.
- Las vacantes se muestran como estado real, no como ausencia silenciosa.

---

### Épica V3-DASH-06 — Incumbentes e historial de cargos

**Objetivo:** mostrar la sucesión histórica de responsables usando lenguaje eclesial adecuado.

#### Decisión terminológica

Evitar usar “incumbentes” en la interfaz pública. Usar términos eclesiales según el contexto:

- `Sucesión episcopal`
- `Obispos anteriores`
- `Ordinarios anteriores`
- `Párrocos anteriores`
- `Historial de responsables`
- `Sucesión de titulares`
- `Historial de nombramientos`

#### Tareas

1. Mostrar responsables actuales por contexto.
2. Mostrar responsables anteriores con fechas de inicio y fin.
3. Separar activos, eméritos, fallecidos e históricos.
4. Permitir filtrar por cargo.
5. Mostrar vacantes y períodos sin titular cuando existan datos.
6. Enlazar cada persona a su ficha pública.

#### Criterio de cierre

- Cada diócesis puede mostrar su sucesión episcopal.
- Cada parroquia puede mostrar párroco actual y párrocos anteriores si existen datos.
- El dashboard puede contar obispos activos, eméritos y fallecidos dentro de un contexto.

---

### Épica V3-DASH-07 — Panel de calidad de datos público/administrativo contextual

**Objetivo:** ver fichas incompletas por contexto sin convertir “no identificado” en error permanente.

#### Tareas

1. Agregar métrica de fichas incompletas por contexto.
2. Diferenciar:
   - faltante
   - no identificado
   - no aplica
   - pendiente de validar
   - completo
3. Permitir ir desde el dashboard administrativo a la cola de corrección.
4. En público, mostrar solo estados permitidos y no exponer datos privados.
5. Permitir filtrar por tipo de ficha incompleta.

#### Criterio de cierre

- El sistema distingue ausencia real de dato, dato no aplicable y dato pendiente.
- Los administradores pueden priorizar correcciones por país, diócesis, parroquia o tipo de persona.

---

## 6. Cambios recomendados en arquitectura

### 6.1 Backend / Supabase

Crear o consolidar funciones para:

```text
get_public_dashboard_context
get_public_context_breadcrumb
get_public_context_children
get_public_context_summary
get_public_context_people
get_public_context_assignments
get_public_context_completeness
```

Reutilizar lo existente cuando aplique:

- `get_entity_descendants`
- vistas públicas de entidades
- vistas públicas de asignaciones con jerarquía
- vistas de completitud
- `organization_charts`
- `organization_units`

### 6.2 Next.js

Agregar:

```text
src/app/api/dashboard/context/route.ts
src/lib/public/dashboard-context.ts
src/features/public/PublicContextBreadcrumb.tsx
src/features/public/PublicContextFilters.tsx
src/features/public/PublicContextResults.tsx
src/features/public/PublicContextQualityPanel.tsx
src/features/public/PublicContextOrganizationChart.tsx
```

Modificar progresivamente:

```text
src/features/public/PublicDashboardExplorer.tsx
src/features/public/usePublicDashboardModel.ts
src/features/public/buildPublicDashboardScope.ts
```

### 6.3 URL pública esperada

Ejemplos:

```text
/?vista=territorial&pais=DO
/?vista=territorial&pais=DO&provincia=santo-domingo
/?vista=territorial&jurisdiccion=<uuid>
/?vista=clero&jurisdiccion=<uuid>&tipo_persona=priest&estado=active
/?vista=territorial&jurisdiccion=<uuid>&nivel=decanato&nodo=<uuid>
/?vista=clero&jurisdiccion=<uuid>&cargo=parroco&completitud=incomplete
/?vista=territorial&jurisdiccion=<uuid>&fecha=1995-01-01
```

---

## 7. Orden recomendado de ejecución

1. Definir contrato de `/api/dashboard/context`.
2. Crear servicio `dashboard-context.ts` sin cambiar UI.
3. Crear consultas/RPC de breadcrumb y descendientes públicos.
4. Conectar contexto país → provincia → jurisdicción.
5. Agregar niveles internos configurados por diócesis.
6. Agregar parroquia/nodo como contexto seleccionable.
7. Agregar filtros independientes de persona, cargo, estado y completitud.
8. Sincronizar todos los filtros con URL.
9. Agregar panel de calidad de datos contextual.
10. Agregar navegación histórica por fecha.
11. Agregar organigramas automáticos.
12. Agregar sucesión/historial de responsables por contexto.
13. Cubrir con pruebas de URL, filtros y datos vacíos.
14. Confirmar rendimiento y caché.

---

## 8. Pruebas requeridas

### 8.1 Pruebas unitarias / contractuales

- Construcción de URL del dashboard.
- Lectura de filtros desde URL.
- Construcción de contexto.
- Normalización de provincia eclesiástica.
- Selección de diócesis dentro del país correcto.
- Filtros de persona.
- Filtros de cargo.
- Filtros de completitud.
- Modo histórico.

### 8.2 Pruebas E2E

Casos mínimos:

1. Abrir `/` y ver explorador.
2. Seleccionar país.
3. Seleccionar provincia eclesiástica.
4. Seleccionar diócesis.
5. Cambiar a vista de clero.
6. Filtrar sacerdotes.
7. Limpiar filtro individual.
8. Copiar URL y recargar; debe conservar estado.
9. Entrar en modo histórico y volver al actual.
10. Ver mensaje de estado vacío cuando no hay resultados.

### 8.3 Accesibilidad

- Todos los selectores deben tener label.
- Los tabs deben mantener roles ARIA correctos.
- El breadcrumb debe ser navegación semántica.
- Los cambios de resultados deben anunciarse con región viva cuando aplique.
- Debe funcionar con teclado.
- Debe respetar modo oscuro y herramientas de accesibilidad.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Reintroducir lógica pesada en cliente | Resolver agregaciones en servicio/RPC y cachear. |
| Mezclar jerarquía civil con jerarquía eclesial | Mantener país/provincia civil separados de provincia eclesiástica y estructura canónica. |
| Imponer una jerarquía fija | Leer niveles desde estructura activa configurada. |
| Mostrar datos históricos como actuales | Usar `as_of_date` y avisos visibles. |
| Exponer datos privados en público | Usar solo vistas públicas y RLS. |
| Duplicar filtros entre vistas | Centralizar estado y URL en un hook/modelo común. |
| Hacer organigramas manuales | Generar desde estructuras, unidades, cargos y asignaciones. |

---

## 10. Estado final esperado de v3

Al cerrar esta línea de trabajo, el portal público deberá permitir:

- Entrar por país.
- Bajar a provincia eclesiástica.
- Bajar a diócesis o arquidiócesis.
- Bajar a los niveles internos reales de esa diócesis.
- Seleccionar parroquia o nodo interno.
- Ver métricas del contexto.
- Ver personas, cargos, entidades e instituciones dentro del contexto.
- Filtrar por tipo, cargo, estado, completitud y fecha.
- Ver sucesión histórica de responsables.
- Ver organigramas automáticos.
- Compartir la URL exacta del estado del dashboard.

La meta no es solo tener un dashboard bonito, sino un **explorador eclesial contextual, histórico y verificable**.
