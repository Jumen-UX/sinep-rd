# Seguridad de datos

> Estado: norma vigente  
> Última revisión: 2026-07-10  
> Alcance: frontend, API, Supabase, almacenamiento y operación

## Principios

- Mínimo privilegio.
- Defensa en profundidad.
- Separación entre información pública, interna y privada.
- Autorización por permiso y alcance jurisdiccional.
- Trazabilidad de acciones sensibles.
- Ningún secreto en el navegador, repositorio o logs.

## Clasificación de información

| Clase | Ejemplos | Exposición permitida |
|---|---|---|
| Pública | nombre publicado, función, jurisdicción, biografía aprobada, fuente pública | Vistas/RPC públicas controladas |
| Interna | estados de revisión, alertas, métricas administrativas | Usuarios autenticados con permiso |
| Privada | documentos de validación, contactos no públicos, familia, notas, evidencias | Flujos administrativos específicos |
| Secreta | service role, credenciales, tokens y enlaces de recuperación | Solo servidor o gestor de secretos |

Un campo no se considera público solo por vivir en una tabla accesible desde Supabase.

## Controles por capa

### Navegador

- Mostrar únicamente datos necesarios para la tarea.
- No confiar en campos ocultos ni estados del cliente para autorizar.
- No incluir service role ni secretos en variables `NEXT_PUBLIC_*`.
- Evitar registrar payloads privados en consola.

### API de Next.js

- Usar `requireAdminAccess` con el permiso correspondiente.
- Validar y normalizar el body antes de invocar la base.
- Traducir errores técnicos a mensajes seguros.
- No devolver detalles de políticas, SQL o trazas al cliente.
- Registrar en auditoría las operaciones sensibles.

### RPC administrativas

- Revalidar identidad, permiso y alcance; la API no es la única barrera.
- Ejecutar operaciones compuestas de forma transaccional.
- Fijar un `search_path` seguro en funciones `security definer`.
- Revocar ejecución de `anon` y `public` cuando no corresponda.
- Evitar SQL dinámico; si es imprescindible, parametrizar y limitar identificadores.

### Row Level Security

Cada tabla expuesta por la API de Supabase debe responder explícitamente:

1. ¿Qué puede leer `anon`?
2. ¿Qué puede leer `authenticated`?
3. ¿Qué puede modificar cada rol?
4. ¿Cómo se limita la operación a la jurisdicción autorizada?

Las políticas permisivas se revisan en conjunto: varias políticas pueden ampliar el acceso de forma no evidente.

### Lectura pública

- Preferir vistas `security_invoker` o RPC públicas de contrato estrecho.
- Conceder solo `SELECT`/`EXECUTE` imprescindible.
- Excluir columnas sensibles desde la definición, no desde la UI.
- Aplicar estado, visibilidad y publicación aprobada.

### Archivos y fotografías

- Validar tipo, tamaño y destino.
- Separar almacenamiento público y privado.
- Eliminar archivos huérfanos cuando falle un flujo.
- No usar el nombre original como ruta confiable.
- Las evidencias privadas requieren URLs firmadas y vida limitada.

## Autenticación y sesiones

- Supabase Auth administra la sesión mediante cookies técnicas.
- Middleware renueva la sesión y protege el área administrativa.
- Las rutas administrativas requieren además un rol activo y permisos.
- Recuperación e invitación deben usar una URL base controlada.
- En producción se exige HTTPS.

## Auditoría

Registrar como mínimo:

- Actor autenticado.
- Acción.
- Tabla o recurso afectado.
- Identificador del objetivo.
- Jurisdicción o alcance cuando aplique.
- Fecha y metadata no sensible.

No copiar documentos, secretos o notas privadas completas dentro de la metadata de auditoría.

## Checklist para cambios

- [ ] Datos clasificados como públicos, internos, privados o secretos.
- [ ] Permiso y alcance validados en API y RPC.
- [ ] RLS revisada para todos los roles.
- [ ] Acceso anónimo concedido únicamente al contrato público.
- [ ] Payload y errores no filtran información sensible.
- [ ] Operación compuesta es transaccional.
- [ ] Acción sensible queda auditada.
- [ ] Pruebas cubren acceso permitido y denegado.

## Operación pendiente

- Confirmar en el panel de Supabase que la protección contra contraseñas filtradas esté habilitada.
- Revisar periódicamente asesores de seguridad, permisos `anon`, funciones `security definer` y buckets.
- Definir rotación y respuesta ante exposición de secretos.

## Documentos relacionados

- [Arquitectura](./ARQUITECTURA.md)
- [Reglas de base de datos](./REGLAS_BASE_DATOS.md)
- [Política pública de privacidad](<../../src/app/(public)/privacidad/page.tsx>)
