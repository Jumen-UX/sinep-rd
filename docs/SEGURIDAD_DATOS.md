# Seguridad de datos

Este documento resume reglas operativas para proteger datos y permisos en SINEP RD.

## Principios

- Las acciones administrativas deben pasar por funciones RPC controladas.
- Las tablas con datos privados deben tener RLS activo.
- El frontend no debe consultar datos privados directamente.
- La informacion publica debe separarse de la informacion interna.
- Las fotos, documentos y datos de validacion deben tratarse como datos sensibles cuando aplique.

## RPC administrativas

Las RPC administrativas deben validar que el usuario tenga un rol activo antes de guardar cambios.

Ejemplos de acciones que deben mantenerse controladas:

- Crear o modificar personas.
- Crear o modificar entidades eclesiasticas.
- Crear o modificar estructura interna.
- Crear cargos o nombramientos.
- Aprobar solicitudes.
- Marcar fallecimiento.

## RLS

Cada tabla publica debe revisarse bajo esta pregunta:

- Que puede leer un usuario anonimo.
- Que puede leer un usuario autenticado.
- Que puede modificar un usuario autenticado.
- Que solo puede modificar un administrador.

## Datos privados

No se deben exponer al navegador datos como:

- Documentos de validacion.
- Telefonos internos no publicos.
- Notas internas.
- Evidencias privadas.
- Datos familiares privados.

## Regla para nuevas pantallas

Antes de crear una pantalla nueva, verificar:

1. Que vista o RPC debe usar.
2. Que RLS aplica.
3. Si el dato es publico o privado.
4. Si se necesita historial o vigencia.
5. Si existe ya un flujo administrativo equivalente.

## Pendiente operativo

Activar proteccion contra contrasenas filtradas en Supabase Auth desde el panel del proyecto.