# Arquitectura de información y navegación administrativa

> Estado: contrato aprobado para implementación
> Sprint: S7-02
> Fecha: 2026-07-16
> Fuente de verdad: permisos efectivos, asignaciones activas y alcance autorizado

## 1. Objetivo

Definir una navegación administrativa coherente, predecible y segura que muestre a cada usuario únicamente los módulos, tareas y acciones relevantes para sus permisos efectivos y su alcance activo.

Este contrato separa tres conceptos que no deben confundirse:

- **Rol:** agrupación administrativa de permisos.
- **Permiso:** capacidad concreta para consultar, proponer, revisar, aprobar, publicar o administrar.
- **Alcance:** conjunto de entidades sobre las que el permiso puede ejercerse.

La navegación es una ayuda de orientación y reducción de errores. La autorización real continúa siendo responsabilidad del backend, las RPC y las políticas de acceso.

## 2. Evidencia de partida

El sistema dispone actualmente de once roles canónicos:

| Grupo operativo | Roles |
|---|---|
| Administración sin restricción territorial | `super_admin`, `national_admin` |
| Administración territorial | `diocesan_admin` |
| Aprobación | `diocesan_approver`, `pastoral_approver` |
| Edición y propuesta | `diocesan_editor`, `vicariate_editor`, `zone_editor`, `parish_editor`, `pastoral_editor` |
| Consulta | `internal_viewer` |

Los permisos se organizan en los módulos `appointments`, `audit`, `change_requests`, `documents`, `entities`, `events`, `imports`, `pastorals`, `people`, `reports`, `security`, `structures` y `users`.

Los alcances admitidos son `global`, `national`, `diocese`, `vicariate`, `zone`, `parish`, `pastoral_area`, `organization_unit` y `entity`.

## 3. Principios obligatorios

1. **Permiso y alcance antes que rol.** Ningún componente debe decidir visibilidad únicamente con comparaciones como `role === 'admin'`.
2. **Autorización en backend.** Ocultar una opción no reemplaza la validación de RPC, API, RLS o servicio de dominio.
3. **Consulta y operación son estados diferentes.** Tener permiso de lectura no habilita botones de creación, revisión, aprobación o publicación.
4. **El alcance siempre es visible.** El usuario debe saber qué jurisdicción, área pastoral, unidad o entidad está consultando o modificando.
5. **Sin callejones sin salida.** Una ruta no debe mostrarse si el usuario no puede realizar ninguna acción útil dentro de ella.
6. **Las restricciones se explican.** Cuando una función es relevante pero no está disponible por estado o alcance, debe mostrarse bloqueada con una razón comprensible; cuando no pertenece al trabajo del usuario, se oculta.
7. **La navegación se genera desde un registro canónico.** El shell, el dashboard, los accesos rápidos y la navegación móvil no mantendrán listas independientes.

## 4. Contexto canónico de navegación

La UI consumirá un contexto normalizado, cargado por un servicio y no mediante consultas dispersas dentro de componentes:

```ts
export type AdminNavigationContext = {
  userId: string
  accessState: 'ready' | 'onboarding' | 'no_role' | 'blocked'
  profileStatus: string
  roles: Array<{
    key: string
    name: string
    scopeType: string
    scopeEntityId: string | null
    scopeLabel: string
    isUnrestricted: boolean
  }>
  permissionKeys: string[]
  modules: string[]
  activeScope: {
    type: string
    entityId: string | null
    label: string
    isUnrestricted: boolean
  }
  availableScopes: Array<{
    type: string
    entityId: string | null
    label: string
  }>
}
```

### Reglas del contexto

- `super_admin` y `national_admin` se consideran sin restricción territorial para navegación, sin omitir validaciones de permisos concretos.
- Los demás roles conservan el alcance de cada asignación activa.
- Si existe un único alcance, se presenta como contexto no editable.
- Si existen varios alcances, se habilita un selector explícito.
- Cambiar el alcance activo solo filtra y orienta la experiencia; nunca amplía las autorizaciones del usuario.
- El alcance activo debe persistirse en la URL cuando afecte el contenido consultado, mediante parámetros estables y compartibles.

## 5. Estados de disponibilidad

Cada destino o acción tendrá uno de cuatro estados:

| Estado | Uso |
|---|---|
| `available` | El usuario puede entrar y realizar al menos una tarea útil. |
| `read_only` | Puede consultar, pero las acciones de modificación se ocultan o deshabilitan. |
| `blocked` | La función es relevante, pero falta una condición corregible; se muestra el motivo. |
| `hidden` | No corresponde al rol, permiso o alcance y no debe ocupar espacio cognitivo. |

Los estados `available` y `read_only` pueden aparecer en la navegación. `blocked` se reserva principalmente para acciones contextuales y flujos iniciados. `hidden` es el comportamiento por defecto cuando no existe permiso de lectura.

## 6. Registro canónico de rutas

La siguiente matriz define la arquitectura objetivo. `Cualquiera de` significa que basta uno de los permisos enumerados para mostrar el destino; las operaciones internas siguen validando su permiso específico.

| Destino | Sección | Permiso de entrada | Operación principal | Restricción de alcance | Prioridad móvil |
|---|---|---|---|---|---:|
| `/admin` | Inicio | Acceso administrativo `ready` | Consultar resumen contextual | Alcance activo | 100 |
| `/admin/nuevo` | Crear | Cualquiera de `people.create_proposal`, `entities.create_proposal`, `pastorals.create_proposal`, `appointments.create_proposal`, `events.create_proposal` | Elegir un asistente permitido | Alcance activo | 80 |
| `/admin/importar` | Trabajo | Cualquiera de `imports.prepare`, `imports.review`, `imports.apply` | Preparar, revisar o aplicar lotes | Alcance activo | 70 |
| `/admin/jurisdicciones` | Directorios | `entities.view` | Consultar entidades territoriales | Alcance territorial | 60 |
| `/admin/estructura` | Configuración operativa | `structures.manage` | Configurar niveles y nodos | Alcance autorizado | 45 |
| `/admin/organizacion` | Directorios | `pastorals.view` o `entities.view` | Consultar organización pastoral y unidades | Alcance pastoral o territorial | 55 |
| `/admin/personas` | Directorios | `people.view` | Consultar personas | Alcance activo | 90 |
| `/admin/asignaciones` | Directorios | `appointments.view` | Consultar nombramientos | Alcance activo | 75 |
| `/admin/paises` | Sistema | `security.view` | Consultar catálogo nacional | Solo `global` o `national` | 20 |
| `/admin/eventos` | Directorios | `events.view` | Consultar historial y efemérides | Alcance activo | 50 |
| `/admin/revision` | Centro de trabajo | `change_requests.view` | Consultar solicitudes; revisar según permisos | Alcance activo | 85 |
| `/admin/incompatibilidades-canonicas` | Centro de trabajo | `appointments.view` | Consultar incompatibilidades; resolver según permiso | Alcance activo | 65 |
| `/admin/actividad` | Control | `audit.view` | Consultar actividad auditada | Alcance autorizado | 35 |
| `/admin/usuarios` | Sistema | `users.view` | Consultar usuarios; administrar con `users.manage` o `users.assign_roles` | Nacional o ámbito delegable | 30 |
| `/admin/configuracion` | Sistema | `security.view` | Consultar configuración; modificar con `security.manage` | Solo `global` o `national` para cambios globales | 25 |

### Reglas complementarias

- El destino **Países** no se mostrará a usuarios con alcance territorial restringido aunque posean permisos generales de consulta.
- **Usuarios** puede mostrarse a un administrador diocesano con `users.view`, pero las invitaciones y asignaciones deben limitarse a roles y alcances delegables por el backend.
- **Estructura** es una herramienta operativa, no un directorio de solo lectura; por eso requiere `structures.manage`.
- **Configuración** debe distinguir catálogos consultables de cambios globales protegidos por `security.manage`.
- **Incompatibilidades canónicas** pertenece al centro de trabajo, no a la navegación de datos generales.

## 7. Arquitectura de secciones

La navegación lateral se reorganizará en cinco grupos:

1. **Inicio**
   - Resumen administrativo.
2. **Crear y gestionar**
   - Agregar ficha.
   - Importaciones.
3. **Directorios**
   - Jurisdicciones.
   - Organización.
   - Personas.
   - Nombramientos.
   - Eventos.
4. **Centro de trabajo**
   - Solicitudes pendientes.
   - Incompatibilidades canónicas.
   - Otras bandejas futuras mediante el mismo contrato.
5. **Sistema y control**
   - Estructura.
   - Actividad.
   - Usuarios.
   - Países.
   - Configuración.

Una sección vacía después del filtrado no se renderiza.

## 8. Selector de alcance

El selector se ubicará en el encabezado operativo del shell y seguirá estas reglas:

- **Un alcance:** mostrar una etiqueta persistente, sin control desplegable.
- **Varios alcances:** mostrar selector con tipo y nombre completo.
- **Acceso nacional o global:** mostrar `Ámbito nacional` o `Ámbito global`, sin selector territorial artificial.
- **Cambio con formulario sucio:** solicitar confirmación antes de navegar o recargar datos.
- **Cambio de alcance:** actualizar URL, indicadores, bandejas, accesos rápidos y resultados de búsqueda.
- **Sin alcance válido:** bloquear la entrada operativa y explicar que la asignación administrativa debe corregirse.

## 9. Navegación móvil

La barra móvil tendrá un máximo de cuatro destinos visibles:

1. **Inicio**, siempre.
2. Los dos destinos disponibles con mayor prioridad móvil.
3. **Más**, como botón que abre un panel con el registro completo filtrado.

`Más` no navegará directamente a Configuración. Debe abrir un panel accesible con:

- contexto de alcance;
- secciones y destinos permitidos;
- perfil y cierre de sesión;
- acceso a ayuda.

El sidebar no se convertirá simultáneamente en una segunda navegación horizontal. En resoluciones móviles se utiliza un único patrón.

## 10. Acciones del dashboard

Los accesos rápidos y tarjetas del dashboard utilizarán el mismo registro canónico:

- una acción de creación solo aparece si su permiso concreto está disponible;
- una tarjeta de consulta requiere el permiso `*.view` correspondiente;
- una alerta de revisión requiere acceso a su bandeja;
- los contadores deben respetar el alcance activo;
- ningún enlace del dashboard puede apuntar a una ruta oculta para el usuario.

## 11. Búsqueda administrativa

La búsqueda global debe declarar explícitamente qué dominios puede consultar el usuario:

- `people.view` habilita personas;
- `entities.view` habilita entidades;
- `documents.view` habilita documentos;
- `appointments.view` habilita nombramientos;
- `events.view` habilita eventos.

Mientras no exista un buscador federado, el campo no debe prometer dominios que todavía no consulta. La implementación actual que redirige siempre a Personas debe etiquetarse como `Buscar personas` hasta completar la búsqueda global.

## 12. Contrato técnico de implementación

La implementación se dividirá en responsabilidades separadas:

- `admin-navigation-contract.ts`: registro estático de rutas, secciones, permisos y prioridad.
- `admin-navigation-service.ts`: carga y normalización de usuario, roles, permisos y alcances.
- `admin-navigation-policy.ts`: funciones puras para calcular disponibilidad y filtrar destinos.
- `AdminNavigationProvider.tsx`: contexto compartido para shell, dashboard y acciones.
- `AdminShell.tsx`: composición visual sin consultas directas a Supabase.

El contador de incompatibilidades y otros indicadores de bandejas deberán cargarse mediante servicios especializados, no dentro del shell.

## 13. Pruebas obligatorias

### Unitarias

- Filtrado de rutas por permiso.
- Restricción adicional por alcance.
- Diferencia entre lectura y operación.
- Selección de prioridades móviles.
- Eliminación de secciones vacías.
- Cálculo de alcance único, múltiple y sin restricción.

### Integración y E2E

Como mínimo deben cubrirse estos perfiles:

- `super_admin` con acceso completo.
- `diocesan_admin` restringido a una diócesis.
- `diocesan_approver` sin acciones de propuesta.
- `parish_editor` sin módulos de sistema.
- `pastoral_editor` limitado a su pastoral.
- `internal_viewer` en modo consulta.
- usuario sin rol activo.
- usuario con estado bloqueado.

Las pruebas deben comprobar tanto la visibilidad de navegación como la respuesta de autorización al intentar acceder directamente a una ruta.

## 14. Criterios de aceptación de S7-02

- Existe un único registro canónico de navegación.
- El shell no mantiene listas paralelas para escritorio y móvil.
- Cada destino tiene permiso de entrada, restricción de alcance y prioridad definidos.
- El alcance activo se muestra siempre y puede seleccionarse solo cuando existen varias opciones válidas.
- Los roles de edición, aprobación y consulta reciben experiencias diferenciadas.
- Las rutas de sistema se restringen por permiso y alcance nacional o global.
- Dashboard, navegación lateral, panel móvil y accesos rápidos consumen el mismo contrato.
- La búsqueda no promete dominios que no consulta.
- Las reglas cuentan con pruebas unitarias y E2E representativas.

## 15. Secuencia de implementación

1. Crear contrato, política y pruebas unitarias puras.
2. Crear servicio y proveedor del contexto administrativo.
3. Sustituir las listas estáticas del `AdminShell`.
4. Implementar selector o etiqueta de alcance.
5. Sustituir la navegación móvil duplicada por barra priorizada y panel `Más`.
6. Conectar dashboard y accesos rápidos al mismo registro.
7. Añadir pruebas de visibilidad por perfil y acceso directo.
8. Ejecutar `pnpm check` y validar CI antes de cerrar S7-02.
