# Arquitectura de SINEP RD

SINEP RD debe funcionar como una plataforma historica y relacional de informacion eclesiastica y pastoral.

La aplicacion no debe asumir una jerarquia fija como diocesis, vicaria, zona y parroquia. Cada diocesis puede definir su propia estructura interna.

## Principio central

El frontend consulta la estructura activa de la diocesis y renderiza los niveles disponibles de forma dinamica.

Ejemplos validos:

- Diocesis, zona pastoral, parroquia.
- Arquidiocesis, vicaria, zona pastoral, parroquia.
- Diocesis, decanato, parroquia, comunidad.
- Diocesis, area pastoral, sector, capilla.

## Motor de estructura

El motor se basa en:

- Plantillas de estructura por diocesis.
- Tipos de estructura: territorial, pastoral, administrativa y organica.
- Niveles configurables.
- Nodos historicos.
- Eventos de cambio: creacion, division, fusion, traslado, supresion o cambio de dependencia.

## Regla para formularios

Los formularios administrativos no deben guardar rutas de texto como `Vicaria Norte / Zona A / Parroquia X`.

Deben guardar identificadores normalizados:

- Entidad eclesiastica.
- Nodo estructural cuando aplique.
- Fechas de vigencia.
- Fuente o nota de verificacion.

## Selector dinamico

El componente base para escoger parroquias, capillas, comunidades o unidades pastorales es:

`src/components/admin/StructureEntityPicker.tsx`

Este componente usa:

- `get_structure_templates`
- `get_structure_tree`
- `get_structure_child_level_options`

## API de creacion rapida

Cuando una unidad no existe, el sistema puede crear entidad y nodo desde:

`src/app/api/admin/estructura/nodo-entidad/route.ts`

La API crea primero la entidad eclesiastica y luego crea el nodo dentro de la estructura activa.

## Regla de diseno

Seleccionar primero. Escribir solo cuando no exista una opcion valida.

Todo lo que pueda ser catalogo debe cargarse como lista controlada o lista oficial.