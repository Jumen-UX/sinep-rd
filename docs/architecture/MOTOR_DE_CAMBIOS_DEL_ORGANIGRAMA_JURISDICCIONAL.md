# Motor de cambios del organigrama jurisdiccional

> Estado: vigente
> Fecha: 2026-08-05
> Propietario: arquitectura, datos y dominio jurisdiccional
> Depende de: `PLAN_DE_CUENTAS_JURISDICCIONAL.md`

## Objetivo

Definir cómo se modifica el organigrama jurisdiccional vigente sin mezclar hechos históricos, operaciones organizativas y correcciones editoriales.

El motor debe sostener:

- el organigrama vigente;
- la cronología pública de cada jurisdicción;
- las referencias a jurisdicciones, relaciones y estados que dejaron de estar vigentes;
- la auditoría completa de acciones administrativas.

La reconstrucción visual del organigrama para una fecha histórica queda diferida a una segunda fase. El modelo conservará fechas y relaciones cerradas para no impedir esa capacidad futura, pero la primera versión no ofrecerá selector temporal, snapshots ni comparación de árboles por fecha.

## Clasificación obligatoria de una operación

Toda operación debe declarar uno de estos orígenes:

### 1. Evento histórico

Representa un hecho institucional o canónico documentado.

Ejemplos:

- erección;
- elevación;
- cambio de nombre oficial;
- cambio de dependencia;
- unión;
- división;
- supresión;
- restauración;
- modificación territorial cuando afecte la identidad o dependencia jurisdiccional.

Requisitos mínimos:

- jurisdicción principal afectada;
- tipo de evento;
- fecha efectiva;
- fuente documental;
- resumen público;
- efectos estructurales declarados;
- estado editorial: borrador, revisado o publicado.

Un evento histórico puede generar múltiples efectos atómicos sobre cuentas y relaciones. Solo los eventos aplicados y publicados forman parte de la historia pública.

### 2. Cambio organizativo

Modifica el organigrama vigente mediante una operación administrativa controlada, pero no se publica automáticamente como acontecimiento histórico.

Ejemplos:

- completar una relación faltante;
- ajustar el orden visual sin cambiar dependencia canónica;
- corregir una relación importada provisionalmente;
- establecer visibilidad o estado operativo;
- cerrar una relación organizativa incorrecta.

Requisitos mínimos:

- motivo interno;
- usuario responsable;
- fecha de operación;
- estado anterior y posterior;
- referencia opcional a expediente o fuente.

### 3. Corrección administrativa

Corrige calidad de datos sin alterar la realidad institucional.

Ejemplos:

- ortografía;
- formato de nombre;
- fecha cargada incorrectamente;
- fuente mal vinculada;
- traducción;
- metadatos o visibilidad.

La corrección:

- produce auditoría;
- no crea evento histórico;
- no aparece en la cronología pública;
- debe conservar valores anterior y posterior.

## Modelo conceptual

### Registro de operación

Cada solicitud de cambio crea una operación principal:

```ts
type JurisdictionChangeOperation = {
  id: string
  origin: 'historical_event' | 'organizational_change' | 'administrative_correction'
  status: 'draft' | 'validated' | 'applied' | 'rejected' | 'reverted'
  publicationStatus: 'internal' | 'draft' | 'reviewed' | 'published'
  primaryAccountId: string
  eventTypeId: string | null
  effectiveDate: string | null
  reason: string
  publicTitle: string | null
  publicSummary: string | null
  sourceDocumentId: string | null
  createdBy: string
  validatedBy: string | null
  appliedAt: string | null
}
```

### Efectos atómicos

Una operación puede contener varios efectos ordenados:

```ts
type JurisdictionChangeEffect = {
  id: string
  operationId: string
  sequence: number
  targetType: 'account' | 'edge'
  targetId: string | null
  action:
    | 'create_account'
    | 'update_account'
    | 'activate_account'
    | 'deactivate_account'
    | 'create_dependency'
    | 'close_dependency'
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
}
```

### Jurisdicciones afectadas

Una operación puede relacionar varias cuentas con roles explícitos:

- principal;
- origen;
- destino;
- antecedente;
- sucesora;
- relacionada.

La jurisdicción principal es la que recibe el evento en su cronología. Las demás permiten explicar divisiones, uniones, traslados y sucesiones sin confundir dependencia vigente con relación histórica.

### Evento público

Solo las operaciones de origen `historical_event`, estado `applied` y publicación `published` alimentan la cronología pública.

```ts
type PublishedJurisdictionEvent = {
  operationId: string
  jurisdictionAccountId: string
  eventType: string
  effectiveDate: string
  title: string
  summary: string
  sourceDocumentId: string
}
```

## Flujo de aplicación

1. El editor inicia una operación desde el organigrama o desde la ficha de jurisdicción.
2. Selecciona el origen del cambio.
3. El sistema adapta el formulario:
   - evento histórico: exige fecha efectiva, fuente, título y resumen público;
   - cambio organizativo: exige motivo interno;
   - corrección administrativa: exige justificación y comparación de valores.
4. Se generan efectos atómicos en estado borrador.
5. El backend valida reglas padre/hijo, ciclos, vigencias, duplicados y permisos.
6. Una función transaccional aplica todos los efectos o ninguno.
7. Se registra auditoría de la operación y de cada efecto.
8. Si la operación es histórica, está aplicada y publicada, se proyecta en la cronología pública.

## Casos principales

### Erección de una jurisdicción

- crea cuenta;
- crea dependencia vigente;
- registra estado canónico;
- publica evento de erección;
- exige fuente y fecha efectiva.

### Elevación

- conserva identidad estable;
- actualiza la clasificación canónica mediante un efecto controlado;
- registra antecedentes cuando corresponda;
- publica evento de elevación.

### Cambio de dependencia

- cierra la relación anterior;
- crea la nueva relación con la misma fecha efectiva;
- valida que no exista ciclo ni segundo padre vigente;
- puede ser histórico o una corrección organizativa según la intención y evidencia.

### Corrección de nombre

- actualiza el campo afectado;
- conserva antes y después en auditoría;
- no aparece en historia, salvo que se trate de un cambio oficial documentado.

### Supresión

- cierra relaciones vigentes;
- cambia estado canónico y operativo;
- conserva la cuenta para consultas y referencias históricas;
- la retira del organigrama vigente;
- publica evento de supresión.

## Integridad transaccional

La aplicación debe ejecutarse mediante una función o RPC transaccional. No se permiten cambios parciales desde el cliente.

Validaciones mínimas:

- permisos por rol y ámbito;
- regla padre/hijo válida;
- ausencia de ciclos;
- máximo de un padre vigente;
- intervalos de vigencia coherentes;
- fuente obligatoria para eventos históricos;
- fecha efectiva obligatoria para eventos históricos;
- título y resumen obligatorios para publicación histórica;
- `beforeState` coincidente con el estado actual para evitar sobrescrituras concurrentes.

## Auditoría

La auditoría debe responder:

- quién realizó la operación;
- quién la validó;
- cuándo se aplicó;
- desde qué interfaz o proceso;
- qué cambió exactamente;
- cuál era el valor anterior;
- cuál es el valor posterior;
- si fue revertida y por quién.

La auditoría nunca debe presentarse como historia pública de la jurisdicción.

## Proyecciones de lectura

La primera fase debe alimentar vistas separadas:

- organigrama vigente;
- cronología pública;
- referencias históricas de antecedentes y sucesoras;
- operaciones administrativas;
- auditoría técnica;
- cambios pendientes de validación.

La proyección del organigrama a una fecha histórica queda fuera de esta fase.

## Experiencia administrativa moderna

Desde cada nodo del organigrama se ofrecerán acciones contextuales:

- Ver ficha;
- Añadir jurisdicción dependiente;
- Cambiar dependencia;
- Registrar evento histórico;
- Corregir información;
- Ver historial organizativo;
- Ver auditoría.

Antes de guardar, el sistema mostrará una vista previa del impacto:

- ramas afectadas;
- relación que se cierra;
- relación que se crea;
- fecha desde la que aplica;
- contenido que aparecerá públicamente;
- contenido que permanecerá solo en auditoría.

## Alcance de la primera implementación

1. contrato de operación y efectos;
2. tablas y restricciones;
3. catálogo de tipos de eventos;
4. vista de cronología pública;
5. vista administrativa de operaciones;
6. RPC transaccional de aplicación;
7. pruebas de integridad y concurrencia;
8. integración con el organigrama administrativo vigente.

## Segunda fase diferida

- regresión histórica del árbol;
- selector libre de fecha;
- comparación entre dos fechas;
- animación de evolución jurisdiccional;
- snapshots o materializaciones históricas, solo si fueran necesarias por rendimiento.

No se reincorporan personas, parroquias, organismos ni instituciones durante esta fase.
