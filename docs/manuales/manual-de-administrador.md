# Manual de administrador — SINEP RD

> Estado: vigente para beta interna
> Última actualización: 20 de julio de 2026
> Aplicación: Sistema Nacional de Información Eclesiástica y Pastoral de República Dominicana

## 1. Propósito

Este manual describe la operación administrativa de SINEP RD: gestión de usuarios, permisos, estructuras, personas, entidades, cargos, revisiones, importaciones, auditoría y mantenimiento funcional.

No sustituye la documentación técnica de desarrollo, despliegue, base de datos, copias de seguridad o recuperación ante desastres.

## 2. Público objetivo

- Administradores nacionales.
- Administradores diocesanos.
- Responsables institucionales.
- Revisores con funciones administrativas.
- Personal autorizado para calidad y gobierno de datos.

## 3. Principios de administración

1. **Menor privilegio:** cada cuenta debe tener solo los permisos necesarios.
2. **Alcance obligatorio:** un permiso debe limitarse al territorio o institución correspondiente.
3. **Trazabilidad:** toda operación sensible debe generar auditoría.
4. **Historia inmutable:** los cambios históricos se corrigen mediante nuevos eventos, no borrando el pasado.
5. **Fuente canónica:** los módulos deben utilizar el modelo de datos vigente definido por el proyecto.
6. **Calidad antes de publicación:** ningún dato dudoso debe publicarse sin revisión.
7. **Separación de ambientes:** los datos de prueba no deben mezclarse con producción.

## 4. Niveles administrativos

Los nombres exactos pueden variar según la configuración, pero el sistema debe distinguir al menos:

### 4.1 Administración nacional

Puede gestionar configuraciones y datos dentro del alcance nacional autorizado.

### 4.2 Administración diocesana

Gestiona únicamente la diócesis o jurisdicción asignada y sus estructuras dependientes.

### 4.3 Administración institucional o parroquial

Gestiona entidades específicas dentro de un alcance más limitado.

### 4.4 Revisión

Puede validar, observar, aprobar o rechazar registros según permisos, sin recibir automáticamente capacidad para configurar usuarios o estructuras.

## 5. Acceso al portal administrativo

1. Inicie sesión con una cuenta autorizada.
2. Abra el portal administrativo.
3. Verifique el ámbito activo mostrado por la interfaz.
4. Confirme que los módulos visibles corresponden a su rol.

Si aparece un módulo fuera de su alcance, no realice cambios y notifíquelo como incidente de permisos.

## 6. Panel administrativo

El panel debe resumir:

- Registros recientes.
- Tareas pendientes de revisión.
- Indicadores de calidad.
- Alertas de integridad.
- Actividad administrativa auditada.
- Estado de importaciones.
- Cargos vacantes o conflictos detectados.

Los indicadores no sustituyen la revisión detallada de cada módulo.

### 6.1 Búsqueda interna

La búsqueda del panel consulta personas, entidades y unidades organizativas dentro de los permisos y alcances del usuario. Utilice al menos dos caracteres y abra siempre el destino administrativo explícito del resultado. La ausencia de un resultado no autoriza a crear un duplicado sin revisar los catálogos y flujos especializados.

## 7. Gestión de usuarios

### 7.1 Crear o habilitar una cuenta

1. Verifique la identidad y relación institucional del solicitante.
2. Cree o habilite la cuenta mediante el flujo autorizado.
3. Asigne el rol mínimo necesario.
4. Defina el ámbito territorial o institucional.
5. Revise los permisos efectivos.
6. Comunique al usuario las reglas de seguridad.
7. Compruebe la auditoría de la operación.

### 7.2 Modificar roles o alcance

Antes de ampliar privilegios:

- Confirme la autorización institucional.
- Revise conflictos de funciones.
- Documente el motivo.
- Evite permisos globales cuando un alcance específico sea suficiente.

### 7.3 Suspender acceso

Suspenda una cuenta cuando:

- Termine la relación institucional.
- Exista riesgo de seguridad.
- Se detecte uso indebido.
- La cuenta permanezca sin responsable válido.

La suspensión debe conservar el historial del usuario y sus acciones.

### 7.4 Revisión periódica

Realice revisiones periódicas de:

- Cuentas activas.
- Roles administrativos.
- Alcances asignados.
- Usuarios inactivos.
- Permisos excepcionales.

## 8. Roles, permisos y alcance

Un permiso efectivo debe responder tres preguntas:

1. ¿Qué acción puede ejecutar el usuario?
2. ¿Sobre qué tipo de registro?
3. ¿Dentro de qué territorio o institución?

Ejemplos de acciones:

- Consultar datos administrativos.
- Crear personas.
- Editar entidades.
- Gestionar nombramientos.
- Aprobar registros.
- Configurar estructuras.
- Administrar usuarios.
- Ejecutar importaciones.

Nunca confíe únicamente en la visibilidad de un botón; la autorización debe validarse también en API y base de datos.

## 9. Catálogos

Los catálogos controlan los valores reutilizados por el sistema, como:

- Tipos de persona.
- Estados ministeriales.
- Cargos.
- Tipos de entidad.
- Tipos de estructura.
- Tipos de evento.
- Fuentes documentales.
- Países, subdivisiones, idiomas y monedas.
- Estados de validación.

### Reglas

- Busque antes de crear un valor.
- Evite sinónimos y variantes ortográficas.
- No elimine valores utilizados; desactívelos o historícelos.
- Documente la fuente normativa cuando corresponda.
- Mantenga identificadores estables.

## 10. Estructuras eclesiales

SINEP RD separa las estructuras:

- Territoriales.
- Pastorales.
- Administrativas.
- Orgánicas o colegiales.

### 10.1 Configurar una estructura

1. Seleccione la diócesis o jurisdicción.
2. Seleccione el tipo de estructura.
3. Cree o revise la plantilla.
4. Configure niveles y relaciones padre-hijo permitidas.
5. Configure cargos permitidos por nivel.
6. Cree o vincule los nodos.
7. Defina vigencia y fuente.
8. Valide el árbol antes de activarlo.

### 10.2 Validaciones mínimas

- Debe existir una raíz válida.
- Cada nodo activo debe tener una relación coherente con su padre.
- No deben existir ciclos.
- Los niveles deben respetar las reglas configuradas.
- Los cargos deben asociarse a niveles válidos.
- La estructura activa debe tener vigencia definida.

### 10.3 Cambios estructurales

Las operaciones de creación, división, fusión, desmembramiento, traslado, supresión o cambio de dependencia deben tramitarse mediante eventos cuando el flujo esté habilitado.

No modifique silenciosamente relaciones históricas para representar una reorganización.

## 11. Personas

### 11.1 Búsqueda previa

Antes de crear:

- Busque por nombre y variantes.
- Revise fecha de nacimiento y documentos disponibles.
- Verifique diócesis, instituto, comunidad o entidad relacionada.
- Revise posibles coincidencias.

### 11.2 Identidad única

Una persona debe conservar un único registro durante toda su historia. La ordenación diaconal, presbiteral o episcopal, el ingreso a una comunidad religiosa o el cambio de cargo no justifican crear otra persona.

### 11.3 Datos privados

- Restrinja documentos personales, contactos privados y validaciones internas.
- Publique únicamente información autorizada.
- No copie datos sensibles en campos públicos o notas generales.

### 11.4 Fotografías

- Utilice formatos permitidos.
- Verifique autorización y procedencia.
- Evite archivos excesivamente grandes.
- Reemplace o retire fotografías mediante el flujo autorizado.
- Compruebe que no queden archivos huérfanos.

## 12. Entidades y lugares físicos

Distinga entre:

- Entidades territoriales o pastorales.
- Organismos administrativos o colegiales.
- Lugares físicos, como iglesias, capillas, santuarios y catedrales.

Una parroquia y el templo que funciona como su sede no son el mismo registro. Sus fechas, historia, ubicación y relaciones pueden ser diferentes.

## 13. Cargos y nombramientos

### 13.1 Crear una asignación

1. Seleccione la persona correcta.
2. Seleccione el nodo o entidad.
3. Elija un cargo permitido para ese nivel.
4. Defina vigencia y estado.
5. Registre la fuente.
6. Revise conflictos de titularidad.
7. Confirme cierres y sucesiones propuestos.
8. Verifique la auditoría.

### 13.2 Sustituciones

Cuando existe un titular vigente:

- Revise si el nuevo nombramiento realmente lo sustituye.
- Cierre la asignación anterior con la fecha correcta.
- Vincule predecesor y sucesor cuando corresponda.
- No elimine el nombramiento anterior.

### 13.3 Vacantes

Una vacante debe registrarse explícitamente cuando sea relevante. No la represente mediante una persona ficticia.

## 14. Revisión y publicación

### 14.1 Criterios de revisión

- Identidad correcta.
- Ausencia de duplicados.
- Ámbito correcto.
- Coherencia estructural.
- Fechas válidas.
- Fuente suficiente.
- Datos privados protegidos.
- Impacto histórico entendido.

### 14.2 Observaciones

Las observaciones deben ser concretas, verificables y accionables. Evite mensajes genéricos como “revisar datos”.

### 14.3 Publicación

Publique únicamente registros aprobados y aptos para exposición pública. Confirme la ficha resultante después de publicar.

## 15. Eventos históricos

El flujo recomendado es:

1. Borrador.
2. Validación.
3. Plan de impacto.
4. Aprobación.
5. Aplicación transaccional.
6. Auditoría.
7. Historial.

Antes de aprobar, revise:

- Registros que se crearán.
- Relaciones que se cerrarán.
- Entidades que cambiarán de dependencia.
- Cargos afectados.
- Elementos que permanecerán como históricos.

## 16. Importaciones

### 16.1 Preparación

- Use la plantilla correcta y su versión vigente.
- No cambie encabezados sin utilizar el mapeo de columnas.
- Normalice nombres, fechas y códigos.
- No incluya credenciales ni información no autorizada.

### 16.2 Revisión del lote

Compruebe:

- Filas válidas.
- Errores.
- Advertencias.
- Duplicados probables.
- Relaciones no resueltas.
- Catálogos faltantes.
- Alcance de los cambios.

### 16.3 Aplicación

Aplique únicamente lotes revisados. La operación debe ser transaccional, idempotente y auditada.

### 16.4 Datos de prueba

Los datos de prueba deben identificarse claramente y eliminarse antes de la puesta en producción, sin borrar tablas ni estructura de base de datos.

## 17. Auditoría

La auditoría debe permitir identificar:

- Actor.
- Fecha y hora.
- Acción.
- Tabla o dominio.
- Registro afectado.
- Cambios relevantes.
- Motivo o metadatos.
- Identificador de solicitud.

### Revisión de incidentes

1. Identifique el registro y período.
2. Revise la secuencia de acciones.
3. Confirme permisos y alcance del actor.
4. Determine el impacto.
5. Corrija mediante el flujo funcional correspondiente.
6. Documente la resolución.

No altere registros de auditoría para ocultar errores.

## 18. Calidad de datos

Clasifique las ausencias como:

- Dato no requerido.
- No identificado.
- Pendiente de completar.
- No aplica.
- Error de importación.

Revise periódicamente:

- Personas sin perfil correspondiente.
- Registros sin fuente.
- Entidades sin relación estructural válida.
- Plantillas sin raíz.
- Cargos sin nivel permitido.
- Fichas sin slug o enlaces válidos.
- Fotografías huérfanas.
- Duplicados probables.

## 19. Seguridad operativa

- No comparta cuentas.
- Utilice contraseñas robustas.
- Cierre sesión en equipos compartidos.
- No publique secretos, tokens ni variables de entorno.
- No copie datos de producción a entornos inseguros.
- Revise permisos después de cambios organizativos.
- Reporte inmediatamente accesos fuera de alcance.

## 20. Gestión de incidentes

Ante un error grave:

1. Detenga nuevas operaciones relacionadas.
2. Registre fecha, usuario, pantalla y acción.
3. Conserve mensajes, hora e identificadores de solicitud o `request_id`.
4. Determine si hubo modificación parcial.
5. Revise auditoría y estado de datos.
6. Escale al responsable técnico.
7. No realice correcciones masivas improvisadas.
8. Documente la solución y prevención.

## 21. Operaciones que requieren procedimiento técnico separado

- Despliegues.
- Migraciones de base de datos.
- Gestión de variables de entorno.
- Copias de seguridad.
- Restauración.
- Rotación de credenciales.
- Limpieza masiva de datos.
- Recuperación ante incidentes.
- Configuración de Supabase y Vercel.

Estas operaciones deben documentarse en una guía técnica de operación.

## 22. Lista de comprobación antes de producción

- Usuarios y permisos revisados.
- Datos de prueba eliminados.
- Auditoría operativa.
- RLS y alcance verificados.
- Integridad estructural validada.
- Importaciones cerradas.
- Fichas públicas revisadas.
- Enlaces administrativos probados.
- Accesibilidad y modo oscuro comprobados.
- CI y E2E en verde.
- Copia de seguridad y restauración probadas.
- Manuales actualizados con la versión desplegada.

## 23. Historial del documento

| Versión | Fecha | Cambios |
|---|---|---|
| 0.1 | 16 de julio de 2026 | Estructura inicial del manual. |
| 0.2 | 20 de julio de 2026 | Búsqueda administrativa, correlación de incidentes y estado de beta. |
