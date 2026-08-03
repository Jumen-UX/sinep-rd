---
status: active
owner: product-and-platform
updated: 2026-08-03
---

# Auditoría técnica — Centro del Usuario y funciones comunes

## Objetivo

Consolidar el inventario real de capacidades existentes relacionadas con identidad, acceso, perfil, seguridad, preferencias, notificaciones, mensajes, soporte y autorregistro. Este documento evita crear sistemas paralelos y define qué debe reutilizarse, ampliarse o implementarse.

## Resumen ejecutivo

SINEP dispone de una base madura para autenticación administrativa, invitaciones, recuperación, onboarding, roles, permisos, ámbitos y auditoría. No existe todavía un Centro del Usuario transversal ni contratos propios para autorregistro controlado, preferencias personales persistentes, notificaciones internas, mensajería operativa, soporte o gestión personal de sesiones.

La decisión arquitectónica es separar:

- cuenta de autenticación;
- perfil personal de acceso;
- persona eclesial canónica;
- solicitud de acceso;
- asignación administrativa;
- preferencias;
- notificaciones y mensajes.

## Matriz de cobertura

| Área | Estado | Evidencia actual | Decisión |
|---|---|---|---|
| Inicio y cierre de sesión | Cubierto | Flujo administrativo existente | Reutilizar |
| Invitaciones | Cubierto | Endpoint administrativo de invitación y plantillas de correo | Reutilizar |
| Recuperación de contraseña | Cubierto | Rutas y servicio de recuperación | Reutilizar |
| Cambio de contraseña en sesión | Parcial | Existe política y recuperación, no centro personal consolidado | Implementar en `/cuenta/seguridad` |
| Onboarding | Cubierto para administración | Estado durable y rutas específicas | Reutilizar y desacoplar de `/admin` |
| Estados de acceso | Cubierto parcialmente | ready, onboarding, pending assignment, blocked | Ampliar para autorregistro y solicitud |
| Perfil básico | Parcial | `profiles` usado para nombre, correo y estado | Ampliar sin duplicar identidad |
| Persona eclesial vinculada | Parcial | Modelo canónico de personas separado | Añadir vínculo explícito cuenta-persona |
| Autorregistro | Ausente | No existe flujo público `signUp` | Implementar controlado |
| Solicitud de acceso | Parcial | Existe administración de solicitudes y estado pendiente | Crear entrada autogestionada |
| Roles, permisos y ámbitos | Cubierto | Contratos canónicos y navegación contextual | Solo lectura en Mi cuenta |
| Preferencias personales | Ausente como contrato persistente | Tema y accesibilidad se resuelven en UI | Crear perfil de preferencias reutilizando controles existentes |
| Notificaciones internas | Ausente | Solo correos de autenticación y avisos de módulos | Crear contrato transversal |
| Mensajes internos | Ausente | No hay bandeja ni conversaciones | Implementar mensajes operativos mínimos después de notificaciones |
| Actividad personal | Parcial | Auditoría administrativa disponible | Crear proyección restringida al usuario |
| Sesiones y dispositivos | Ausente en UI | Supabase Auth administra sesiones | Implementar capacidades soportadas sin inventar dispositivos |
| MFA | Ausente en producto | Depende de configuración Auth | Implementar por fases |
| Soporte | Parcial | Manuales y ayuda contextual dispersos | Crear `/cuenta/ayuda` y casos de soporte |
| Legal y privacidad | Pendiente de consolidación | No existe centro único validado | Crear páginas y registro de aceptación |
| Cierre/eliminación de cuenta | Ausente | Administración puede suspender accesos | Diseñar solicitud controlada |

## Capacidades existentes que deben reutilizarse

### Autenticación y recuperación

- cliente y servidor de Supabase Auth;
- login administrativo;
- recuperación de contraseña;
- plantillas personalizadas de correo;
- validación central de contraseña;
- cierre de sesión.

### Acceso administrativo

- resolución canónica del estado de entrada;
- roles y permisos tipados;
- ámbitos globales, nacionales, jurisdiccionales y organizativos;
- onboarding durable;
- suspensión y revocación;
- auditoría de cambios.

### Personas e identidad eclesial

- `persons` como identidad canónica;
- detección de duplicados;
- reutilización explícita de una persona existente;
- historiales sacramentales y organizativos separados;
- flujos de revisión para cambios sensibles.

### Experiencia y preferencias visuales

- tema claro/oscuro;
- contraste y preferencias de accesibilidad;
- reducción de movimiento;
- componentes de estados y formularios;
- navegación responsive.

## Brechas confirmadas

### Autorregistro controlado

Debe crear únicamente una cuenta autenticada y un perfil básico. No debe crear roles, ámbitos ni personas eclesiales automáticamente.

Flujo propuesto:

1. crear cuenta;
2. confirmar correo;
3. completar perfil básico;
4. buscar coincidencias de persona sin revelar datos privados;
5. solicitar vinculación o declarar que no encuentra su ficha;
6. presentar solicitud de acceso;
7. revisión administrativa;
8. asignación de rol y ámbito;
9. onboarding;
10. acceso habilitado.

### Estados ampliados

Estados de experiencia requeridos:

- `email_pending`;
- `profile_incomplete`;
- `access_not_requested`;
- `access_requested`;
- `under_review`;
- `additional_information_required`;
- `approved_pending_assignment`;
- `onboarding`;
- `ready`;
- `rejected`;
- `blocked`;
- `suspended`.

No todos deben persistirse en una sola columna. Algunos pueden derivarse de correo confirmado, completitud del perfil, solicitud activa y asignaciones vigentes.

### Centro del Usuario

Rutas previstas:

- `/cuenta`;
- `/cuenta/perfil`;
- `/cuenta/acceso`;
- `/cuenta/notificaciones`;
- `/cuenta/mensajes`;
- `/cuenta/seguridad`;
- `/cuenta/preferencias`;
- `/cuenta/actividad`;
- `/cuenta/ayuda`.

Debe ser accesible para cualquier usuario autenticado, incluso sin acceso administrativo listo.

## Modelo de datos mínimo propuesto

Los nombres definitivos deberán validarse contra el esquema aplicado antes de crear migraciones.

### Extensión de perfil

Preferir ampliar `profiles` solo con datos propios de cuenta:

- `display_name`;
- `avatar_url`;
- `locale`;
- `timezone`;
- `person_id` nullable;
- `profile_completed_at`;
- `terms_accepted_at`;
- `privacy_accepted_at`.

No almacenar aquí estado clerical, asignaciones ni datos canónicos de la persona.

### Solicitudes de acceso

Reutilizar el dominio de solicitudes si admite una solicitud creada por el propio usuario. Si no, crear un contrato especializado que preserve:

- solicitante autenticado;
- país y jurisdicción pretendida;
- función declarada;
- motivo;
- referencia institucional;
- persona candidata;
- estado;
- revisor;
- decisión y motivo;
- historial.

### Preferencias

Una única fila por usuario con valores explícitos y defaults de aplicación:

- tema;
- contraste;
- tamaño de texto;
- movimiento reducido;
- idioma;
- zona horaria;
- formato de fecha;
- densidad;
- canales de notificación.

No duplicar preferencias que puedan permanecer localmente salvo que sea necesario sincronizarlas entre dispositivos.

### Notificaciones

Contrato mínimo:

- destinatario;
- categoría;
- título;
- resumen;
- prioridad;
- entidad relacionada tipada;
- fecha de creación;
- fecha de lectura;
- fecha de archivo;
- productor o evento origen;
- deduplicación opcional.

### Mensajes

Primera versión sin chat en tiempo real:

- hilo contextual;
- participantes;
- asunto;
- mensajes inmutables;
- leído por destinatario;
- relación con solicitud, revisión o soporte.

## Reglas de seguridad

- ningún autorregistro recibe rol o ámbito automático;
- toda solicitud se crea para `auth.uid()`;
- un usuario solo lee y modifica su perfil permitido;
- una cuenta no puede vincularse a otra persona sin revisión cuando exista ambigüedad;
- cambios canónicos generan solicitud, no escritura directa;
- notificaciones solo son legibles por su destinatario;
- mensajes solo por participantes y revisores autorizados;
- preferencias solo por su propietario;
- actividad personal es una proyección, no acceso completo a auditoría;
- acciones sensibles requieren reautenticación cuando Supabase lo soporte;
- aceptación legal se registra con versión del documento.

## Decisiones de simplicidad

- no crear chat en tiempo real en la primera fase;
- no crear una segunda tabla de identidad personal;
- no duplicar roles ni permisos dentro del perfil;
- no persistir preferencias que no necesiten sincronización;
- no exponer la auditoría administrativa completa;
- no construir gestión de dispositivos más allá de las capacidades reales de Supabase Auth;
- no crear un sistema genérico de tareas hasta que los casos concretos estén definidos.

## Orden de implementación validado

### AR-01 — Autorregistro seguro

- ruta pública de registro;
- confirmación de correo;
- protección antiabuso;
- cuenta sin privilegios;
- estado inicial claro.

### AR-02 — Perfil inicial y vinculación

- perfil básico;
- coincidencias seguras;
- solicitud de vinculación;
- prevención de duplicados.

### AR-03 — Solicitud de acceso

- formulario progresivo;
- seguimiento de estado;
- petición de información adicional;
- decisión auditada.

### CU-02 — Shell de Mi cuenta

- layout autenticado independiente de administración;
- navegación desde avatar;
- resumen personal;
- accesible sin rol administrativo.

### CU-03 — Perfil, acceso y preferencias

- edición de datos simples;
- roles y ámbitos de solo lectura;
- preferencias sincronizadas necesarias.

### CU-04 — Notificaciones

- bandeja;
- contador;
- lectura y archivo;
- productores iniciales: acceso, revisión, seguridad e importaciones.

### CU-05 — Seguridad

- cambio de contraseña;
- MFA si está habilitado;
- cierre de sesión global según capacidad disponible;
- actividad de seguridad.

### CU-06 — Mensajes y soporte

- mensajes contextuales;
- solicitudes de ayuda;
- seguimiento de casos;
- manuales y FAQ.

### CU-07 — Legal, privacidad y cierre

- términos y privacidad;
- consentimiento versionado;
- rectificación;
- exportación y cierre controlado.

## Criterios de cierre de CU-01

CU-01 queda cerrada cuando:

- se confirma el esquema aplicado de `profiles` y solicitudes;
- se decide si se amplían tablas existentes o se crean contratos nuevos;
- se define el vínculo cuenta-persona;
- se documentan estados derivados y persistidos;
- se valida el modelo RLS;
- se priorizan AR-01, AR-02 y AR-03 antes del shell completo;
- existen pruebas contractuales para evitar roles automáticos y duplicación de personas.

## Próximo paso

Inspeccionar las migraciones aplicadas que definen `profiles`, onboarding, solicitudes, roles y acceso; después producir el contrato SQL definitivo de AR-01 a AR-03 antes de implementar UI.