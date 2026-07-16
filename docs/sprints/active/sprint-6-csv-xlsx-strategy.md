# Sprint 6 — Estrategia CSV y XLSX

## Decisión

CSV UTF-8 es el único formato procesable durante S6-03. XLSX y XLS permanecen reconocidos como formatos de origen habituales, pero deben exportarse a CSV UTF-8 antes de cargarse.

No se incorpora una dependencia de hojas de cálculo en esta etapa porque el flujo actual ya tiene un contrato seguro y probado sobre datos tabulares de texto, mientras que añadir lectura binaria introduciría una nueva superficie de dependencias, fórmulas, tipos implícitos, fechas serializadas, hojas múltiples y consumo de memoria. La incorporación futura de XLSX deberá convertir primero el libro al mismo contrato de filas de texto y reutilizar exactamente los validadores existentes.

## Contrato CSV

El lector admite:

- UTF-8 con o sin BOM;
- delimitador de coma, punto y coma o tabulación;
- campos entre comillas;
- comillas escapadas mediante comilla doble;
- saltos de línea LF y CRLF;
- saltos de línea dentro de campos citados.

El lector rechaza:

- delimitadores ausentes o ambiguos;
- comillas sin cerrar;
- caracteres nulos;
- encabezados vacíos o duplicados;
- más de 100 columnas;
- celdas con más de 10,000 caracteres;
- filas con una cantidad de columnas diferente del encabezado.

Los límites de archivo, filas, columnas, celdas y vista previa pertenecen al contrato compartido de importaciones. La API vuelve a aplicar las restricciones críticas; la validación del navegador no sustituye la validación del servidor.

## Condiciones para incorporar XLSX

Una futura implementación debe:

1. usar una dependencia mantenida y auditada;
2. limitar tamaño, hojas, filas, columnas y celdas antes de materializar todo el libro;
3. rechazar macros y contenido ejecutable;
4. convertir fechas, números y booleanos de manera explícita;
5. seleccionar una única hoja de forma visible;
6. no evaluar fórmulas;
7. producir el mismo arreglo `Record<string, string>[]` utilizado por CSV;
8. conservar hash, nombre de hoja y metadatos de conversión;
9. pasar por el mismo staging, validación, revisión y aplicación.

Hasta cumplir esas condiciones, la conversión a CSV UTF-8 es el límite operativo oficial.
