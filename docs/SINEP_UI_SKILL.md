# Skill de Interfaz SINEP RD

Este documento fija los parametros de interfaz para todas las pantallas administrativas y publicas del proyecto SINEP RD.

## Objetivo

La interfaz debe ser clara, sobria, pastoral y facil de usar. Cada pantalla debe explicar que se esta haciendo, que datos son obligatorios y que efecto tendra la accion.

## Principios

1. No mostrar detalles tecnicos al usuario final.
2. Usar lenguaje pastoral y administrativo simple.
3. Priorizar una accion principal por pantalla.
4. Separar datos criticos, datos opcionales y datos privados.
5. Evitar formularios demasiado anchos o visualmente pesados.
6. No usar controles que parezcan rotos, especialmente switches o radios sin etiqueta clara.
7. Cada accion sensible debe explicar su consecuencia antes de guardar.

## Layout base

- Contenedor maximo: 1120px.
- Tarjetas con borde suave, sombra ligera y radio amplio.
- Fondo institucional claro.
- Espaciado vertical generoso.
- Formularios en una sola columna en escritorio cuando hay campos sensibles.
- En movil, todo debe quedar en una sola columna.

## Encabezado de pantalla

Cada pantalla debe iniciar con:

- Eyebrow corto: por ejemplo `Asistente paso a paso`.
- Titulo claro: por ejemplo `Registrar sacerdote`.
- Descripcion breve en lenguaje no tecnico.

No usar textos largos en el hero.

## Pasos de asistentes

Los asistentes deben usar pasos compactos:

- Numero pequeno o mediano.
- Nombre del paso visible.
- Estado activo claro.
- No ocupar demasiado alto.
- En movil se muestran como lista horizontal desplazable o tarjetas pequenas.

Evitar tarjetas gigantes para pasos.

## Formularios

Cada seccion debe tener:

- Eyebrow del paso.
- Titulo corto.
- Texto de ayuda si el campo puede confundir.
- Campos agrupados por contexto.

Reglas:

- Maximo recomendado por seccion: 6 campos visibles.
- Campos criticos primero.
- Campos opcionales debajo.
- Campos privados con texto que indique: `Uso interno. No se publica.`

## Controles de seleccion

No usar radios o switches grandes sin texto pegado al control.

Para opciones importantes usar tarjetas seleccionables:

- Borde visible.
- Titulo de la opcion.
- Descripcion corta.
- Estado seleccionado con borde institucional.

Ejemplo:

- `Si, buscar diacono existente`
- `No, registrar sacerdote nuevo con historial diaconal`

## Botones

- Accion principal: boton primario.
- Accion secundaria: boton secundario.
- Navegacion anterior/siguiente: botones pequenos alineados arriba o abajo de la seccion.
- No mezclar mas de dos estilos de boton en una misma zona.

## Textos

Usar etiquetas en espanol claro:

- `Nombre`
- `Fecha de nacimiento`
- `Lugar de nacimiento`
- `Datos privados de validacion`
- `Cargo actual`
- `Guardar ficha`

Evitar:

- IDs
- Slugs
- Keys
- Enums en ingles
- Nombres de tablas

## Estados sensibles

Para fallecimiento, vacancia, documentos privados o datos familiares:

- Explicar si se publica o no.
- Mostrar consecuencia antes de guardar.
- Mantener historial; nunca sugerir eliminar registros.

## Responsive

En pantallas pequenas:

- Una sola columna.
- Botones a ancho completo si hace falta.
- Pasos compactos.
- Evitar tablas anchas; usar tarjetas cuando sea posible.

## Checklist antes de publicar una pantalla

- El usuario entiende que debe hacer sin leer documentacion externa.
- No aparecen valores tecnicos.
- Los campos privados estan identificados.
- La accion principal es evidente.
- El formulario no se ve saturado.
- La pantalla funciona en escritorio y movil.
- Los mensajes de error son humanos.

## Aplicacion inmediata

Cuando se modifique una pantalla administrativa, primero revisar este archivo y aplicar estos parametros antes de agregar nuevos campos o logica.
