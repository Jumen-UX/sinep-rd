# Plan UX v1 — SINEP RD

> Estado: vigente  
> Actualizado: 2026-07-14  
> Rama operativa: `main`  
> Alcance: portal público, portal administrativo, formularios, directorios, fichas, navegación, accesibilidad, modo oscuro, rendimiento percibido y validación con usuarios.

## 1. Propósito

Este plan convierte la experiencia de usuario en un programa transversal de SINEP RD. No se limita a mejorar la apariencia: organiza cómo las personas encuentran información, registran datos, revisan cambios, comprenden el estado del sistema y ejecutan operaciones sensibles.

El objetivo es que SINEP RD funcione como una sola plataforma coherente, accesible y confiable para visitantes públicos y usuarios administrativos.

## 2. Objetivos generales

1. Unificar la experiencia visual y funcional de toda la plataforma.
2. Reducir la complejidad de navegación y eliminar accesos duplicados.
3. Facilitar el registro y edición mediante asistentes guiados.
4. Prevenir errores y mostrar el impacto de operaciones sensibles.
5. Garantizar modo claro, oscuro y automático, junto con preferencias de accesibilidad.
6. Mejorar la confianza mediante fuentes, vigencia e historial visibles.
7. Asegurar funcionamiento en escritorio, tableta, móvil, teclado y lector de pantalla.
8. Validar la experiencia con usuarios reales antes del lanzamiento público.

## 3. Principios UX obligatorios

### 3.1 Seleccionar antes que escribir

Los formularios deben priorizar catálogos controlados, autocomplete, selectores jerárquicos y opciones filtradas por contexto. La creación contextual se permitirá únicamente cuando no exista el registro necesario.

### 3.2 Una acción principal por pantalla

Cada vista debe tener una acción primaria claramente identificable. Las acciones secundarias no competirán visualmente con ella.

### 3.3 Mostrar contexto y consecuencias

El usuario debe saber siempre dónde está, qué ámbito gestiona, qué registro será afectado, qué cambios se producirán y si el resultado quedará en borrador, revisión o publicación.

### 3.4 Accesibilidad desde la base

El botón flotante de accesibilidad será una herramienta de personalización, no un sustituto de una interfaz accesible.

### 3.5 Historial y trazabilidad visibles

Los datos relevantes deben mostrar fecha efectiva, fecha de actualización, fuente, estado de verificación y vigencia.

### 3.6 Consistencia antes que personalización aislada

No se crearán patrones visuales nuevos por página cuando ya exista un componente compartido adecuado.

## 4. Usuarios y recorridos prioritarios

| Perfil | Necesidades principales |
|---|---|
| Visitante público | Encontrar diócesis, parroquias, personas, estructuras e historia. |
| Consulta interna | Acceder a información ampliada según permisos. |
| Editor parroquial | Proponer y corregir datos dentro de una parroquia. |
| Editor diocesano | Registrar personas, entidades, cargos y estructuras. |
| Aprobador diocesano | Revisar, aprobar o devolver cambios. |
| Administrador nacional | Supervisar datos, usuarios, permisos, importaciones y consistencia. |
| Superadministrador | Configurar catálogos, reglas, estructuras y seguridad. |

### Recorridos que deben validarse

1. Encontrar una diócesis y su autoridad vigente.
2. Encontrar una parroquia.
3. Buscar una persona.
4. Registrar una persona.
5. Asignar un cargo.
6. Resolver un pendiente.
7. Importar un lote.
8. Crear o modificar una estructura.
9. Consultar el estado histórico de una entidad.
10. Verificar la fuente y fecha de un dato.

## 5. Programa de trabajo

El Plan UX se ejecutará en nueve fases. Cada fase debe cerrar con pruebas y criterios de aceptación antes de considerarse completada.

# Fase UX-0 — Consolidación del sistema de diseño

**Prioridad:** crítica  
**Objetivo:** eliminar la fragmentación visual y técnica entre las distintas áreas.

### Tareas

- Inventariar componentes, clases CSS y patrones repetidos.
- Definir tokens semánticos de superficies, texto, bordes, acciones, estados, espaciado, radios, sombras, tipografía y niveles de elevación.
- Crear componentes compartidos:
  - `AppShell`.
  - `PageHeader`.
  - `Breadcrumbs`.
  - `ContextBar`.
  - `Card`.
  - `StatCard`.
  - `Button`.
  - `FormField`.
  - `Select`.
  - `Autocomplete`.
  - `DataTable`.
  - `StatusBanner`.
  - `EmptyState`.
  - `ErrorSummary`.
  - `Dialog`.
  - `Wizard`.
- Sustituir clases genéricas conflictivas por componentes o estilos delimitados por dominio.
- Eliminar dependencias accidentales entre hojas de estilo.
- Crear una referencia visual interna.
- Definir reglas compartidas de impresión.

### Entregables

- Catálogo de tokens.
- Biblioteca de componentes.
- Página de referencia visual.
- Matriz de componentes y estados.
- Guía de uso para nuevas pantallas.

### Criterios de aceptación

- Todas las rutas utilizan los mismos tokens.
- Ninguna página depende del CSS específico de otra ruta.
- Todos los componentes tienen estados de foco, carga, error, éxito y deshabilitado.
- No existen páginas sin estilos o parcialmente degradadas.
- Las pruebas visuales cubren las rutas críticas.

# Fase UX-1 — Temas, modo oscuro y accesibilidad personalizable

**Prioridad:** crítica  
**Objetivo:** permitir una experiencia adaptable sin comprometer el cumplimiento base.

### Temas

Implementar:

- Claro.
- Oscuro.
- Automático según el dispositivo.

Requisitos:

- Aplicar el tema antes del primer render para evitar destellos.
- Persistir la preferencia.
- Adaptar tarjetas, formularios, tablas, modales, organigramas, mapas, gráficos, skeletons, foco, errores y advertencias.
- Mantener la impresión con fondo blanco.
- Utilizar tokens semánticos; no colores directos dispersos en componentes.

### Botón flotante de accesibilidad

Agregar un botón persistente con nombre accesible:

> Abrir opciones de accesibilidad

El panel incluirá:

- Tema claro, oscuro o automático.
- Tamaño de texto: 100 %, 115 % y 130 %.
- Contraste reforzado.
- Subrayado de enlaces.
- Reducción de animaciones.
- Aumento de espaciado de texto.
- Restablecimiento de preferencias.

### Comportamiento accesible

- Uso completo con teclado.
- Cierre con `Escape`.
- Gestión correcta del foco.
- Retorno del foco al botón al cerrar.
- Preferencias persistentes.
- Compatibilidad con `prefers-reduced-motion`.
- Sin bloqueo del zoom del navegador.
- Sin superposición de controles, mensajes o navegación móvil.

### Entregables

- Selector de tema.
- Botón flotante.
- Panel de accesibilidad.
- Pruebas visuales para todos los temas.
- Matriz de contraste.

### Criterios de aceptación

- Contraste WCAG AA en claro y oscuro.
- Sin destello de tema incorrecto al cargar.
- Botón mínimo de 48 × 48 píxeles.
- Panel operable con teclado y lector de pantalla.
- Configuración persistente y reversible.
- Ningún contenido queda cubierto por el botón.

# Fase UX-2 — Arquitectura de información y navegación

**Prioridad:** crítica  
**Objetivo:** reducir la desorientación y eliminar la navegación duplicada.

### Portal público

Organizar la navegación en:

```text
Inicio
Explorar
  ├─ Territorio
  ├─ Personas y ministerios
  ├─ Organización pastoral
  ├─ Organización administrativa
  └─ Organismos colegiales
Jurisdicciones
Historia y eventos
Portal administrativo
```

Tareas:

- Eliminar selectores o pestañas que dupliquen el menú principal.
- Diferenciar “Organización administrativa” de “Portal administrativo”.
- Añadir breadcrumbs.
- Mantener filtros en parámetros URL.
- Añadir navegación interna en fichas extensas.

### Portal administrativo

- Reorganizar por tareas: registrar, revisar, organizar y administrar.
- Adaptar el menú según rol y permisos.
- Mostrar el ámbito activo.
- Permitir cambiar de contexto cuando corresponda.
- Sustituir la tira horizontal móvil por un drawer o menú colapsable.
- Mantener el estado del menú y contexto entre rutas.

### Entregables

- Mapa de navegación público.
- Mapa de navegación administrativo.
- Matriz de navegación por rol.
- Breadcrumbs compartidos.
- Selector de ámbito.

### Criterios de aceptación

- El usuario siempre sabe dónde está y qué ámbito gestiona.
- No existen accesos equivalentes con nombres diferentes.
- Todas las rutas tienen un camino claro de regreso.
- La navegación funciona con teclado y en móvil.

# Fase UX-3 — Búsqueda, directorios y fichas

**Prioridad:** alta  
**Objetivo:** facilitar el descubrimiento y la consulta de información.

### Búsqueda global

Buscar en personas, diócesis, parroquias, templos, organismos, cargos, documentos y eventos.

Incluir:

- Autocompletado.
- Resultados agrupados por tipo.
- Coincidencias aproximadas.
- Navegación por teclado.
- Búsquedas recientes.
- Resultados con contexto.

### Directorios

- Búsqueda por nombre.
- Filtros por tipo y ámbito.
- Orden alfabético.
- Cantidad de resultados.
- Paginación o carga progresiva.
- URL compartible.
- Estado vacío útil.
- Conservación de filtros al volver desde una ficha.

### Fichas

- Índice interno de secciones.
- Resumen inicial.
- Datos vigentes.
- Historia.
- Fuentes.
- Última actualización.
- Estado de verificación.
- Acciones de contacto.
- Versión de impresión.
- Ocultación de filas completamente vacías.

### Entregables

- Buscador global.
- Patrón único de directorio.
- Plantilla de ficha pública.
- Plantilla de ficha administrativa.
- Navegación interna de secciones.

### Criterios de aceptación

- Encontrar un registro importante requiere pocos pasos.
- Los filtros pueden compartirse mediante URL.
- Las fichas explican vigencia, fuente y actualización.
- Los directorios no generan desplazamiento horizontal global.
- La navegación de resultados funciona con teclado.

# Fase UX-4 — Formularios, asistentes y prevención de errores

**Prioridad:** crítica  
**Objetivo:** reducir errores, abandono y carga cognitiva.

### Patrón común

1. Contexto.
2. Selección del sujeto.
3. Datos principales.
4. Relaciones y alcance.
5. Fechas y fuentes.
6. Revisión de impacto.
7. Confirmación.

### Tareas

- Unificar asistentes de sacerdote, diácono, obispo, religioso/a, laico/a, entidad, nombramiento y estructura.
- Guardar automáticamente borradores.
- Recuperar sesiones interrumpidas.
- Avisar sobre cambios sin guardar.
- Mostrar resumen lateral.
- Detectar duplicados temprano.
- Validar por pasos.
- Distinguir campo obligatorio, opcional, no identificado y no aplicable.
- Permitir crear una opción faltante sin abandonar el formulario.
- Mostrar vista previa antes de guardar.
- Confirmar consecuencias.
- Incluir resumen de errores con enlaces a los campos.
- Conservar valores tras un error.

### Operaciones sensibles

Mostrar antes de confirmar:

- Registros afectados.
- Persona reemplazada.
- Asignaciones que se cerrarán.
- Relaciones históricas creadas.
- Incompatibilidades.
- Estado final.
- Justificación requerida cuando corresponda.

### Entregables

- Asistente común.
- Componente de resumen de impacto.
- Sistema de borradores.
- Patrón de validación y errores.
- Diálogo de confirmación sensible.

### Criterios de aceptación

- Los datos no se pierden tras un error.
- Los mensajes explican cómo corregir el problema.
- Ninguna sustitución o cierre ocurre sin resumen previo.
- El usuario puede reanudar un borrador.
- Todos los asistentes comparten la misma estructura.

# Fase UX-5 — Tablas, revisión, tareas y configuración estructural

**Prioridad:** alta  
**Objetivo:** mejorar la eficiencia de los usuarios administrativos frecuentes.

### Tablas y listados

- Encabezados fijos.
- Ordenación.
- Filtros.
- Paginación.
- Selección múltiple.
- Acciones masivas seguras.
- Columnas configurables.
- Densidad cómoda o compacta.
- Exportación autorizada.
- Conservación de filtros.
- Transformación a tarjetas en móvil cuando sea necesario.

### Centro de tareas

Incluir:

- Pendientes asignados.
- Solicitudes de aprobación.
- Importaciones terminadas.
- Errores de datos.
- Incompatibilidades.
- Cambios realizados por otros usuarios.
- Vencimientos.

Clasificar como información, advertencia, acción requerida o urgente.

### Cola de revisión

Mostrar prioridad, tipo, jurisdicción, antigüedad, responsable, estado, evidencia y acción recomendada. Los detalles técnicos quedarán en un segundo nivel.

### Configurador de estructuras

Convertirlo en un espacio de trabajo con árbol estructural y ficha del nodo seleccionado. Incluir:

- Expandir y contraer.
- Buscar nodo.
- Centrar selección.
- Mostrar una sola rama.
- Navegación por teclado.
- Alternativa textual accesible.
- Simulación de impacto para dividir, fusionar, trasladar o suprimir.

### Entregables

- Tabla administrativa compartida.
- Centro de tareas.
- Cola de revisión rediseñada.
- Configurador estructural tipo workspace.
- Componente de árbol accesible.

### Criterios de aceptación

- Las tareas prioritarias son identificables rápidamente.
- Las tablas funcionan en móvil sin romper la página.
- Las acciones masivas requieren confirmación y resumen.
- El árbol estructural puede usarse con teclado.
- Los cambios estructurales muestran su impacto antes de guardarse.

# Fase UX-6 — Confianza, historia, privacidad y contenido

**Prioridad:** alta  
**Objetivo:** hacer comprensibles y confiables los datos.

### Procedencia y vigencia

Mostrar cuando corresponda:

- Fuente.
- Fecha efectiva.
- Fecha de actualización.
- Estado de verificación.
- Responsable.
- Vigencia.
- Alcance.
- Historial de cambios.

### Experiencia histórica

- Selector de fecha histórica.
- Aviso visible cuando se consulta el pasado.
- Línea de tiempo.
- Comparación antes/después.
- Eventos asociados.
- Retorno rápido al presente.
- Distinción entre titular actual, anterior, interino y vacante.

### Privacidad

- Identificar campos públicos, internos y privados.
- Señalar visualmente la visibilidad de cada dato.
- Restringir exportaciones según permisos.
- Gestionar fotografías y datos personales.
- Incluir proceso de corrección de información.
- Evitar exposición accidental de identificadores internos.

### Lenguaje y terminología

Crear un glosario oficial para jurisdicción, entidad, nodo, unidad, estructura, organigrama, cargo, oficio, nombramiento, ámbito, vigencia, fuente y estado canónico.

Eliminar del primer nivel visual UUID, nombres de tablas, RPC y claves internas.

### Entregables

- Componente de procedencia.
- Línea de tiempo.
- Indicador de consulta histórica.
- Matriz de visibilidad.
- Glosario.
- Guía de contenido y mensajes.

### Criterios de aceptación

- El usuario comprende si un dato es actual, histórico o no verificado.
- Cada indicador explica su alcance.
- Los datos privados no aparecen en vistas públicas ni exportaciones no autorizadas.
- La terminología es consistente en toda la plataforma.

# Fase UX-7 — Responsive, rendimiento percibido e impresión

**Prioridad:** alta  
**Objetivo:** garantizar una experiencia estable en todos los contextos.

### Responsive

Probar 320 px, móvil estándar, tableta vertical, tableta horizontal, escritorio, zoom de 200 % y zoom de 400 %.

Requisitos:

- Sin scroll horizontal global.
- Scroll localizado solo en tablas o diagramas necesarios.
- Menú móvil accesible.
- Botones táctiles adecuados.
- Reordenamiento lógico de tarjetas.
- Lectura correcta con aumento de texto.

### Rendimiento percibido

- Skeletons estables.
- Indicadores de progreso.
- Carga progresiva.
- Paginación.
- Consultas diferidas.
- Evitar bloqueos por datos secundarios.
- Evitar saltos visuales.
- Mostrar datos desactualizados o en actualización.

### Impresión y exportación

- Fichas imprimibles.
- PDF limpio.
- CSV/XLSX autorizado.
- Encabezado institucional.
- Fecha y fuente.
- Enlace permanente.
- Controles interactivos ocultos.
- Saltos de página controlados.

### Entregables

- Matriz responsive.
- Presupuesto de rendimiento.
- Skeletons compartidos.
- Plantillas de impresión.
- Exportaciones autorizadas.

### Criterios de aceptación

- La plataforma funciona a 320 px y 400 % de zoom.
- No se producen saltos importantes durante la carga.
- Los listados grandes no bloquean el navegador.
- Las impresiones no generan páginas vacías o bloques cortados.
- Las exportaciones respetan permisos.

# Fase UX-8 — Investigación, pruebas y mejora continua

**Prioridad:** obligatoria antes de la salida pública  
**Objetivo:** validar las decisiones con usuarios reales.

### Pruebas

Realizar sesiones con visitante público, usuario interno, editor parroquial, editor diocesano, aprobador, administrador nacional y superadministrador.

### Métricas

- Finalización de tareas.
- Tiempo por tarea.
- Errores.
- Retrocesos.
- Abandono.
- Solicitudes de ayuda.
- Comprensión del resultado.
- Satisfacción.
- Accesibilidad observada.
- Incidencias por dispositivo.

### Analítica UX

Registrar de forma respetuosa búsquedas sin resultados, formularios abandonados, pasos con mayor error, filtros más usados, rutas con mayor retorno, acciones que requieren ayuda y rendimiento por ruta.

No se registrará información personal sensible ni contenido privado de formularios.

### Entregables

- Guiones de prueba.
- Informes de sesiones.
- Registro de hallazgos.
- Backlog UX priorizado.
- Tablero de métricas.

### Criterios de aceptación

- Los recorridos críticos se completan sin asistencia significativa.
- Los problemas de severidad alta están resueltos.
- No existen bloqueos de teclado o lector de pantalla.
- Los resultados de pruebas están incorporados al backlog.

## 6. Estados obligatorios de cada pantalla

Cada módulo deberá diseñar explícitamente:

- Carga inicial.
- Actualización.
- Vacío inicial.
- Sin resultados.
- Acceso restringido.
- Error recuperable.
- Error irreversible.
- Conexión lenta.
- Éxito.
- Operación parcial.
- Datos desactualizados.
- Confirmación.
- Cambios sin guardar.

Los mensajes dinámicos deberán anunciarse mediante `aria-live` o roles de estado equivalentes.

## 7. Matriz de prioridad

### P0 — Antes de ampliar funcionalidades

- Sistema de diseño único.
- Modo oscuro.
- Botón flotante de accesibilidad.
- Contraste AA.
- Navegación unificada.
- Formularios comunes.
- Prevención de errores.
- Estados del sistema.
- Responsive básico.
- Pruebas visuales.

### P1 — Antes de beta ampliada

- Búsqueda global.
- Directorios y fichas unificados.
- Tablas administrativas.
- Cola de revisión.
- Centro de tareas.
- Confianza y procedencia.
- Configurador estructural.
- Navegación histórica.
- Impresión y exportación.

### P2 — Evolución posterior

- Personalización avanzada.
- Favoritos.
- Vistas guardadas.
- Densidad configurable.
- Internacionalización completa.
- Analítica UX avanzada.
- Mejoras de mapas y organigramas.

## 8. Dependencias con el Plan Maestro

| Trabajo UX | Dependencia técnica |
|---|---|
| Indicadores confiables | Unificación de consultas y fuentes de verdad. |
| Historial visible | Motor de eventos canónico. |
| Ámbito activo | Permisos y alcance territorial consolidados. |
| Asistentes comunes | Servicios y operaciones por dominio. |
| Búsqueda global | Índices y endpoints agregados. |
| Exportaciones | Política de privacidad y permisos. |
| Organigramas | Motor estructural canónico. |
| Centro de tareas | Cola de revisión y eventos operativos. |
| Fuentes visibles | Auditoría y trazabilidad funcional. |
| Preferencias UX | Persistencia local y tokens semánticos. |

## 9. Estrategia de pruebas

### Pruebas automatizadas

- Contraste.
- Axe.
- Navegación por teclado.
- Un solo `h1`.
- Etiquetas de formularios.
- Estados de error.
- Desbordamiento horizontal.
- Presentación en claro y oscuro.
- Presentación a 320 px.
- Presentación con texto al 130 %.
- Posición del botón flotante.
- Persistencia de preferencias.
- Impresión de fichas.
- Regresiones visuales.

### Pruebas manuales

- Lectores de pantalla.
- Zoom de 400 %.
- Modo alto contraste del sistema.
- Navegación solo con teclado.
- Touch.
- Impresión real.
- Dispositivos móviles.
- Navegadores principales.

## 10. Indicadores de éxito

| Indicador | Meta inicial |
|---|---|
| Tareas críticas completadas | ≥ 90 % |
| Formularios abandonados | Reducción progresiva |
| Errores por formulario | Reducción después de cada sprint |
| Rutas con contraste AA | 100 % |
| Rutas sin scroll horizontal global | 100 % |
| Rutas críticas con pruebas visuales | 100 % |
| Operaciones sensibles con resumen de impacto | 100 % |
| Fichas con fuente y actualización | 100 % cuando aplique |
| Navegación completa por teclado | 100 % de rutas críticas |
| Preferencias de accesibilidad persistentes | 100 % |

## 11. Criterios de cierre UX para lanzamiento público

SINEP RD podrá considerarse listo desde la perspectiva UX cuando:

1. Todas las rutas compartan una gramática visual.
2. No existan páginas degradadas o sin estilos.
3. La navegación pública y administrativa sea clara y no duplicada.
4. Cada pantalla tenga una acción primaria.
5. El modo claro y oscuro cumpla contraste AA.
6. El botón flotante de accesibilidad sea completamente operable.
7. La plataforma funcione a 320 px y 400 % de zoom.
8. Los formularios conserven datos y expliquen errores.
9. Las operaciones sensibles muestren impacto antes de ejecutarse.
10. Los indicadores expliquen alcance, fecha y fuente.
11. Las fichas distingan datos vigentes, históricos y no verificados.
12. Las tablas y organigramas funcionen en móvil y con teclado.
13. Los filtros puedan compartirse mediante URL.
14. Los estados de carga, éxito, error y vacío estén diseñados.
15. Las rutas críticas tengan pruebas E2E, accesibilidad y regresión visual.
16. Los recorridos principales hayan sido validados con usuarios reales.

## 12. Orden inmediato recomendado

### Sprint UX 0.1

- Consolidar tokens.
- Definir tema claro y oscuro.
- Crear botón flotante de accesibilidad.
- Corregir contrastes.
- Crear componentes básicos.
- Añadir pruebas visuales de shell público y administrativo.

### Sprint UX 0.2

- Unificar navegación.
- Crear breadcrumbs.
- Mostrar ámbito activo.
- Sustituir navegación móvil horizontal.
- Crear plantillas comunes de página.

### Sprint UX 0.3

- Unificar formularios.
- Implementar resumen de errores.
- Implementar borradores.
- Añadir resumen de impacto.
- Migrar nombramientos y personas al asistente común.

### Sprint UX 0.4

- Unificar directorios y fichas.
- Incorporar búsqueda global.
- Añadir procedencia, actualización e historial.
- Crear impresión y exportación básica.

### Sprint UX 0.5

- Rediseñar tablas, revisión y tareas.
- Convertir estructuras en workspace.
- Completar pruebas responsive, teclado y lector de pantalla.
- Ejecutar pruebas con usuarios.

## 13. Gobierno del Plan UX

Cada funcionalidad nueva deberá incluir:

- Diseño del flujo.
- Componentes reutilizados.
- Estados del sistema.
- Requisitos de accesibilidad.
- Comportamiento responsive.
- Pruebas.
- Métricas.
- Criterios de aceptación.

No se considerará completa una funcionalidad que solo tenga implementación técnica sin experiencia validada.

El Plan UX debe revisarse al cierre de cada sprint y mantenerse vinculado a la [hoja de ruta vigente](./roadmap/ROADMAP.md).