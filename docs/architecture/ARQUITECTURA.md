# Arquitectura de SINEP RD

> Estado: vigente  
> Última revisión: 2026-07-10  
> Audiencia: desarrollo, revisión técnica y operaciones

SINEP RD es una aplicación Next.js con un portal público, un área administrativa y un backend PostgreSQL/Supabase. Su diseño prioriza historia, trazabilidad, alcance jurisdiccional y publicación controlada.

## Capas del sistema

```text
Navegador
  ├─ Portal público
  └─ Administración autenticada
          ↓
Next.js App Router
  ├─ rutas y layouts: src/app
  ├─ módulos de dominio: src/features
  ├─ componentes compartidos: src/components
  └─ autorización y clientes: src/lib
          ↓
API de Next.js y cliente Supabase
          ↓
PostgreSQL / Supabase
  ├─ vistas públicas controladas
  ├─ RLS
  ├─ RPC administrativas
  ├─ auditoría
  └─ historial canónico
```

## Fronteras de responsabilidad

- `src/app`: enrutamiento, layouts, metadata y adaptadores HTTP. Una ruta nueva debe delegar la lógica a un módulo cuando el flujo crezca.
- `src/features`: UI, servicios, hooks, tipos y reglas de cada dominio.
- `src/components`: componentes realmente transversales; no debe convertirse en un segundo directorio de funcionalidades.
- `src/lib`: infraestructura compartida, autorización, validación, privacidad y clientes Supabase.
- `supabase/migrations`: única fuente versionada del esquema, RLS, vistas, funciones e índices.
- `tests`: contratos estructurales, reglas de dominio y pruebas de integración.

## Dominios principales

- Personas y dimensiones canónicas.
- Clero: diaconado, presbiterado y episcopado.
- Vida consagrada y agentes laicos.
- Jurisdicciones y entidades eclesiásticas.
- Estructuras configurables.
- Cargos, nombramientos y sucesión.
- Revisión editorial, auditoría y eventos históricos.
- Catálogos oficiales.

## Modelo canónico de personas

La identidad de una persona no debe duplicarse para representar un cambio eclesial. Las dimensiones se modelan por separado:

- Identidad civil o pública en `persons`.
- Ordenaciones acumulativas en `ordination_events`.
- Estado clerical en su historial correspondiente.
- Función episcopal y dignidades como dimensiones independientes.
- Vida religiosa como dimensión transversal.
- Cargos y servicios mediante asignaciones con vigencia.

Los flujos nuevos deben reutilizar el motor de registro canónico y buscar una identidad existente antes de crear otra.

## Motor de estructura

La jerarquía interna no se fija en columnas como diócesis → vicaría → zona → parroquia. Cada jurisdicción puede configurar:

- Plantillas.
- Niveles.
- Nodos y relaciones padre-hijo.
- Cargos permitidos por nivel.
- Vigencia y eventos de evolución.

Los formularios guardan identificadores normalizados, nunca rutas jerárquicas como texto libre.

## Flujo administrativo seguro

1. La ruta autentica al usuario y valida el permiso requerido.
2. El payload se valida y normaliza en el servidor.
3. La operación compuesta se ejecuta mediante una RPC transaccional.
4. La RPC vuelve a validar permisos y alcance jurisdiccional.
5. RLS protege lecturas y escrituras directas.
6. La acción sensible queda registrada en auditoría.

Ninguna validación del frontend reemplaza los controles del servidor o la base de datos.

## Lectura pública

El portal público consume vistas o RPC diseñadas para publicación. Estas proyecciones deben:

- Excluir datos privados e internos.
- Respetar estado y visibilidad.
- Usar `security_invoker` cuando corresponda.
- Tener permisos anónimos mínimos y explícitos.

## Decisiones obligatorias

- Seleccionar antes de crear.
- Mantener historial en vez de sobrescribir hechos.
- Evitar motores paralelos para el mismo dominio.
- Usar transacciones para operaciones compuestas.
- Tratar rutas y componentes como adaptadores, no como dueños de reglas de negocio.

## Documentos relacionados

- [Convención de módulos](./CONVENCION_MODULOS.md)
- [Reglas de base de datos](./REGLAS_BASE_DATOS.md)
- [Seguridad de datos](./SEGURIDAD_DATOS.md)
- [Stack oficial](./STACK_OFICIAL.md)
- [Estándares web](../standards/ESTANDARES_WEB_SINEP_RD.md)
