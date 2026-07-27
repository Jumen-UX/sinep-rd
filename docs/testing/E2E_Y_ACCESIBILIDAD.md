# E2E y accesibilidad

> Estado: vigente
> Última revisión: 2026-07-27
> Propietario: ingeniería y frontend

## Objetivo

Documentar los modos de ejecución de Playwright y Axe sin mezclar pruebas públicas automáticas, recorridos administrativos de solo lectura y escenarios mutantes.

La suite de navegador no forma parte de `pnpm check`; se ejecuta mediante comandos y workflows específicos para evitar mezclar la compuerta rápida con recorridos que requieren Chromium, credenciales opcionales o un entorno desplegado.

## Preparación local

```bash
pnpm install --frozen-lockfile
pnpm test:e2e:install
```

## Portal público

```bash
pnpm test:e2e:public
```

Cubre rutas públicas seleccionadas, navegación básica, teclado y comprobaciones Axe. El workflow `E2E / Public accessibility` se ejecuta automáticamente cuando cambian rutas públicas cubiertas y también admite ejecución manual.

## Evidencia visual sin credenciales

```bash
pnpm test:e2e:visual
```

Genera capturas reproducibles de `/`, `/admin/login` y `/admin/recuperar/solicitar` en temas claro y oscuro, con viewports móvil, tableta y escritorio. También comprueba encabezado, superficie principal y ausencia de desbordamiento horizontal.

El workflow ejecuta esta suite una sola vez, en la variante con indexación deshabilitada. Conserva las capturas completas dentro del reporte y `test-results` como evidencia diagnóstica, y compara las regiones estables de los shells contra 18 baselines aprobados de Ubuntu/Chromium. El dashboard público compara su encabezado móvil o barra lateral de escritorio; login y recuperación comparan la tarjeta del formulario. Así, los datos públicos vivos no convierten cambios legítimos de contenido en falsos fallos visuales. Consulta la [matriz de validación visual UX](../design/MATRIZ_VALIDACION_VISUAL_UX.md).

Los baselines versionados no deben regenerarse durante una ejecución ordinaria. Una actualización deliberada requiere ejecutar Playwright con `--update-snapshots` en Ubuntu/Chromium, revisar las 18 imágenes y publicar el cambio como un commit temático.

Las rutas autenticadas no forman parte de esta suite porque requieren perfiles protegidos y datos representativos.

## Suite E2E general

```bash
pnpm test:e2e
```

Ejecuta la configuración Playwright aplicable al entorno y variables disponibles.

## Administración de solo lectura

```bash
pnpm test:e2e:admin
```

Se usa para recorridos administrativos preparados para pruebas. Debe ejecutarse únicamente con una cuenta y un entorno autorizados.

## Matriz de acceso

```bash
pnpm test:e2e:access
```

Requiere `E2E_ACCESS_PROFILES_JSON`. La matriz verifica:

- estado efectivo de acceso y redirección;
- navegación visible y oculta por rol;
- módulos identificados como `Consulta`;
- etiqueta del ámbito activo;
- entidad propia visible;
- entidad ajena no visible;
- aislamiento bidireccional entre dos ámbitos.

Antes de instalar Playwright puede validarse únicamente el contrato del secreto:

```bash
node scripts/validate-e2e-access-profiles.mjs
```

El comando lee `E2E_ACCESS_PROFILES_JSON`, no imprime correos ni contraseñas y falla si la cobertura es incompleta.

### Cobertura obligatoria

La matriz completa debe incluir los cuatro estados:

- `ready`;
- `onboarding`;
- `no_role`;
- `blocked`.

Entre los perfiles `ready` debe existir:

- al menos un perfil con `navigationRole: "administrator"`;
- al menos un perfil con `navigationRole: "viewer"`;
- una pareja A↔B donde `ownEntityId` de cada perfil sea `forbiddenEntityId` del otro;
- `expectedScopeLabel`;
- `expectedNavigation.visible`;
- `expectedNavigation.hidden`;
- `expectedNavigation.readOnly`.

`readOnly` debe ser subconjunto de `visible`, y una ruta no puede aparecer simultáneamente en `visible` y `hidden`. Las rutas admitidas deben comenzar por `/admin`. Los IDs deben ser UUID válidos y pertenecer al mismo entorno contra el que se ejecuta la prueba.

### Ejemplo estructural

El siguiente ejemplo no contiene credenciales ni IDs reales:

```json
[
  {
    "label": "Administrador diócesis A",
    "email": "admin-a-e2e@example.invalid",
    "password": "REEMPLAZAR_EN_SECRETO",
    "expectedState": "ready",
    "navigationRole": "administrator",
    "expectedScopeLabel": "Diócesis A",
    "expectedNavigation": {
      "visible": [
        "/admin/nuevo",
        "/admin/personas",
        "/admin/jurisdicciones"
      ],
      "hidden": [
        "/admin/configuracion"
      ],
      "readOnly": []
    },
    "ownEntityId": "11111111-1111-4111-8111-111111111111",
    "forbiddenEntityId": "22222222-2222-4222-8222-222222222222",
    "minimumVisibleDioceses": 1
  },
  {
    "label": "Consulta diócesis B",
    "email": "viewer-b-e2e@example.invalid",
    "password": "REEMPLAZAR_EN_SECRETO",
    "expectedState": "ready",
    "navigationRole": "viewer",
    "expectedScopeLabel": "Diócesis B",
    "expectedNavigation": {
      "visible": [
        "/admin/jurisdicciones",
        "/admin/personas"
      ],
      "hidden": [
        "/admin/nuevo",
        "/admin/importar",
        "/admin/usuarios",
        "/admin/configuracion"
      ],
      "readOnly": [
        "/admin/jurisdicciones",
        "/admin/personas"
      ]
    },
    "ownEntityId": "22222222-2222-4222-8222-222222222222",
    "forbiddenEntityId": "11111111-1111-4111-8111-111111111111",
    "minimumVisibleDioceses": 1
  },
  {
    "label": "Onboarding pendiente",
    "email": "onboarding-e2e@example.invalid",
    "password": "REEMPLAZAR_EN_SECRETO",
    "expectedState": "onboarding"
  },
  {
    "label": "Perfil sin rol",
    "email": "no-role-e2e@example.invalid",
    "password": "REEMPLAZAR_EN_SECRETO",
    "expectedState": "no_role"
  },
  {
    "label": "Perfil bloqueado",
    "email": "blocked-e2e@example.invalid",
    "password": "REEMPLAZAR_EN_SECRETO",
    "expectedState": "blocked"
  }
]
```

Las rutas, etiquetas e IDs deben ajustarse a los permisos y alcances reales de las cuentas de prueba. El secreto completo solo debe almacenarse como `E2E_ACCESS_PROFILES_JSON` en GitHub Actions o en un entorno local protegido.

### Prerequisito de datos

La existencia del secreto no crea cuentas ni alcances. Antes de configurarlo deben existir cuentas técnicas dedicadas y no productivas con:

1. onboarding completo para los perfiles `ready`;
2. roles diferentes para navegación administrativa y consulta;
3. dos alcances territoriales mutuamente excluyentes;
4. un perfil en onboarding;
5. un perfil autenticable sin rol activo;
6. un perfil suspendido o bloqueado;
7. contraseñas conocidas únicamente por quien administra el secreto.

La revisión del 2026-07-27 encontró cuentas nacionales activas, pero ninguna asignación con alcance diocesano. Por tanto, el aislamiento A↔B requiere aprovisionar primero dos cuentas o reasignaciones técnicas en diócesis distintas. No debe simularse modificando el test para aceptar alcance nacional.

## Escenarios mutantes

```bash
pnpm test:e2e:admin:mutation
```

Las pruebas mutantes solo pueden ejecutarse contra entornos no productivos, recuperables y explícitamente autorizados. Nunca habilites `E2E_ALLOW_MUTATIONS=true` contra producción. Deben tener datos de prueba identificables y un procedimiento de limpieza o restauración.

## GitHub Actions

Los workflows canónicos son:

- `CI`: auditorías contractuales, typecheck, pruebas, build, CodeQL y ejecuciones manuales aplicables;
- `E2E / Public accessibility`: Playwright, Chromium y Axe sobre rutas públicas cubiertas;
- `E2E / Admin access matrix`: navegación autenticada y aislamiento de alcance para perfiles protegidos.

`E2E / Admin access matrix` levanta la aplicación localmente cuando cambian el shell, la navegación, el acceso, el validador o la propia matriz. En ejecuciones automáticas por `push`, la ausencia de `E2E_ACCESS_PROFILES_JSON` registra una omisión controlada sin instalar Chromium. En una ejecución manual, la ausencia del secreto falla explícitamente para impedir que un resultado verde se interprete como una validación autenticada real.

Cuando el secreto existe, el workflow valida su esquema y cobertura antes de instalar dependencias. Un JSON sintácticamente correcto pero incompleto falla de forma explícita.

La matriz también puede ejecutarse manualmente desde `CI` indicando `base_url`. Ese job usa el mismo secreto protegido y permite validar un despliegue específico.

Los filtros de rutas pueden hacer que un cambio exclusivamente documental no genere una nueva corrida E2E pública. Esto no convierte una referencia histórica de GitHub Actions en un workflow activo.

## Accesibilidad mínima automatizada

Las rutas críticas deben comprobar, según aplique:

- ausencia de violaciones Axe bloqueantes;
- navegación por teclado;
- un solo `h1`;
- etiquetas de formularios;
- estados de error;
- ausencia de scroll horizontal global;
- claro y oscuro;
- 320 px;
- texto ampliado;
- posición del botón flotante de accesibilidad;
- persistencia de preferencias.

Las pruebas automatizadas no sustituyen lector de pantalla, zoom de 400 %, alto contraste del sistema, touch, impresión real ni validación en dispositivos y navegadores representativos.

## Evidencia

Registrar commit, entorno, comando, fecha, resultado y artefactos. Nunca conservar contraseñas, tokens, service role ni el contenido de `E2E_ACCESS_PROFILES_JSON` en reportes públicos.
