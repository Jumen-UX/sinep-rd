# Centro del Usuario y fundamentos comunes de la aplicación

Estado: activo
Responsable funcional: producto SINEP
Ámbito: experiencia transversal de usuarios autenticados

## Objetivo

Completar las funciones comunes esperables de una aplicación web moderna sin duplicar los contratos existentes de autenticación, perfiles, auditoría, revisión, accesibilidad o navegación.

Este bloque no sustituye la administración de usuarios. Separa claramente:

- `Mi cuenta`: autogestión del usuario autenticado.
- `Administración de usuarios`: invitaciones, roles, ámbitos, estados y accesos de terceros.

## Principios

1. Reutilizar autenticación, perfiles, solicitudes de cambio, auditoría y preferencias existentes.
2. Evitar construir un chat cuando una bandeja operativa resuelve el caso inicial.
3. Mantener separados mensajes persistentes y notificaciones eventuales.
4. No permitir edición directa de datos canónicos sensibles desde el perfil personal.
5. Aplicar permisos, RLS, trazabilidad, accesibilidad y diseño responsive desde el primer incremento.
6. Introducir complejidad progresiva: primero funciones básicas; después productividad avanzada.

## Cobertura funcional objetivo

### 1. Centro personal

Rutas propuestas:

- `/cuenta`
- `/cuenta/perfil`
- `/cuenta/notificaciones`
- `/cuenta/mensajes`
- `/cuenta/seguridad`
- `/cuenta/preferencias`
- `/cuenta/actividad`
- `/cuenta/ayuda`

La ruta `/cuenta` será accesible a todo usuario autenticado, incluso cuando no tenga acceso al área administrativa.

### 2. Perfil

El perfil distingue:

#### Cuenta de acceso

- nombre mostrado;
- correo;
- avatar;
- idioma;
- zona horaria;
- preferencias de interfaz.

#### Ficha eclesial vinculada

- persona canónica asociada;
- fotografía institucional;
- datos públicos autorizados;
- responsabilidades y asignaciones vigentes;
- acceso a solicitud de corrección.

Los datos canónicos sensibles no se modifican directamente. Los cambios generan una solicitud revisable y auditada.

### 3. Notificaciones

Capacidades mínimas:

- listado paginado;
- contador de no leídas;
- marcar una o todas como leídas;
- categorías;
- prioridad;
- enlace seguro al recurso relacionado;
- preferencias por categoría;
- expiración opcional;
- origen del evento.

Categorías iniciales:

- seguridad;
- revisión;
- acceso y permisos;
- importaciones;
- nombramientos;
- calidad de datos;
- sistema.

Las notificaciones de seguridad no podrán silenciarse completamente.

### 4. Mensajes operativos

Primera versión:

- bandeja de entrada;
- enviados;
- archivados;
- estado leído/no leído;
- remitente y destinatario;
- asunto y cuerpo;
- relación opcional con solicitud, revisión o registro;
- adjuntos únicamente si se reutiliza una infraestructura documental segura.

No incluye chat en tiempo real, presencia, escritura en curso ni reacciones.

### 5. Seguridad personal

Funciones mínimas:

- cambio de contraseña desde sesión activa;
- último acceso;
- cierre de sesión actual;
- cierre de otras sesiones cuando Supabase lo permita de forma segura;
- roles y ámbitos vigentes en modo lectura;
- actividad de seguridad;
- MFA como incremento posterior inmediato.

### 6. Preferencias

- tema;
- contraste y accesibilidad;
- reducción de movimiento;
- idioma;
- zona horaria;
- formato de fecha;
- densidad visual;
- preferencias de notificación.

Las preferencias de apariencia y accesibilidad existentes deben reutilizarse; no se creará un segundo sistema paralelo.

### 7. Actividad personal

Debe mostrar únicamente actividad visible para el usuario:

- accesos;
- cambios propios;
- solicitudes creadas;
- decisiones recibidas;
- operaciones relevantes realizadas en su ámbito.

No debe exponer la auditoría administrativa completa.

### 8. Ayuda, soporte y legal

Capacidades mínimas:

- preguntas frecuentes;
- manuales por rol;
- contacto de soporte;
- reporte de error con identificador de incidente;
- solicitud de corrección de datos;
- privacidad;
- términos de uso;
- tratamiento y visibilidad de datos personales;
- información de versión.

## Modelo de datos propuesto

El diseño definitivo debe confirmar primero qué tablas ya existen. Si no existen contratos reutilizables, se proponen:

### `user_account_preferences`

- `user_id`;
- `locale`;
- `timezone`;
- `date_format`;
- `density`;
- `notification_preferences` JSONB limitado por esquema;
- marcas de auditoría.

### `user_notifications`

- `id`;
- `recipient_user_id`;
- `category`;
- `priority`;
- `title`;
- `body`;
- `target_kind`;
- `target_id`;
- `target_url` validada;
- `read_at`;
- `expires_at`;
- `created_at`.

### `user_messages`

- `id`;
- `sender_user_id`;
- `subject`;
- `body`;
- `related_kind`;
- `related_id`;
- `created_at`.

### `user_message_recipients`

- `message_id`;
- `recipient_user_id`;
- `read_at`;
- `archived_at`;
- `deleted_at` lógico.

No se almacenarán secretos, contraseñas ni tokens de sesión en estas tablas.

## Seguridad y control de acceso

- Toda lectura personal debe estar limitada por `auth.uid()`.
- Los mensajes enviados por administradores deben validar permiso y ámbito.
- Las notificaciones automáticas se crearán mediante contratos internos o RPC auditadas.
- Los enlaces relacionados deben validarse contra destinos internos permitidos.
- El perfil personal no podrá elevar roles ni modificar ámbitos.
- La vinculación entre cuenta y persona canónica debe ser explícita, única cuando corresponda y auditable.
- Los borrados serán lógicos cuando exista obligación de trazabilidad.

## Arquitectura de aplicación

### Frontend

- Server Components para vistas iniciales cuando sea viable.
- Componentes cliente pequeños para marcado de lectura, formularios y menús.
- Menú personal accesible desde avatar en escritorio y móvil.
- Estados de carga, error, vacío y sin resultados compartidos.

### Backend

- Servicios por dominio: cuenta, notificaciones, mensajes y seguridad.
- Mutaciones mediante rutas servidor o RPC protegidas.
- Sin acceso directo cliente a tablas críticas.
- Invalidación de caché únicamente donde exista contenido cacheable.

### Navegación

El avatar debe abrir:

- Mi cuenta;
- Mi perfil;
- Notificaciones;
- Mensajes;
- Seguridad;
- Preferencias;
- Cerrar sesión.

## Fases de implementación

### Fase CU-01 — Auditoría y contratos

1. Inventariar perfiles, tablas de notificaciones, auditoría, preferencias y solicitudes existentes.
2. Confirmar vínculo `auth.users` ↔ perfil ↔ persona canónica.
3. Definir RLS y permisos.
4. Definir contratos TypeScript y estados de UI.

Criterio de cierre: no existen capacidades duplicadas ni decisiones de modelo pendientes.

### Fase CU-02 — Shell de Mi cuenta

1. Crear rutas y layout.
2. Incorporar menú desde avatar.
3. Crear resumen personal.
4. Mostrar roles y ámbitos en modo lectura.

Criterio de cierre: todo usuario autenticado puede abrir su centro personal.

### Fase CU-03 — Perfil y preferencias

1. Editar datos de cuenta permitidos.
2. Mostrar ficha eclesial vinculada.
3. Enviar solicitudes para cambios canónicos.
4. Consolidar preferencias existentes.

### Fase CU-04 — Notificaciones

1. Modelo y RLS.
2. Bandeja y contador.
3. Marcar como leída.
4. Integrar primeros productores: seguridad, revisión e importaciones.

### Fase CU-05 — Mensajes

1. Bandeja operativa.
2. Envío autorizado.
3. Archivado y lectura.
4. Relación con solicitudes y revisiones.

### Fase CU-06 — Seguridad, soporte y legal

1. Cambio de contraseña.
2. Actividad de cuenta.
3. Sesiones y MFA según capacidades verificadas de Supabase.
4. Ayuda, soporte, privacidad y términos.
5. Manejo global de errores con identificador de incidente.

### Fase CU-07 — Validación

- pruebas unitarias y contractuales;
- pruebas RLS;
- E2E autenticado;
- accesibilidad;
- responsive móvil;
- modo oscuro;
- revisión de privacidad;
- observabilidad.

## Fuera del alcance inicial

- chat en tiempo real;
- videollamadas;
- comentarios abiertos en cualquier entidad;
- automatizaciones complejas de productividad;
- favoritos, historial reciente y paleta de comandos;
- resúmenes por inteligencia artificial.

Estos elementos se evaluarán después de completar y usar las funciones básicas.

## Criterio de cumplimiento de funciones comunes

SINEP podrá considerarse completo en funciones web comunes cuando disponga, como mínimo, de:

1. autenticación, recuperación y cierre de sesión;
2. centro personal y perfil editable;
3. seguridad personal y cambio de contraseña;
4. notificaciones internas;
5. mensajes operativos;
6. preferencias unificadas;
7. soporte y ayuda;
8. páginas legales y privacidad;
9. manejo global de errores;
10. accesibilidad y responsive;
11. auditoría y observabilidad;
12. pruebas automatizadas de los flujos críticos.

## Dependencias con otros módulos

El centro personal debe completarse antes de extender profundamente:

- flujos de revisión;
- importaciones;
- nombramientos;
- eventos;
- calidad de datos;
- estructura jurisdiccional administrativa.

Estos módulos producirán notificaciones, mensajes o actividad personal y deben apoyarse en un contrato transversal único.
