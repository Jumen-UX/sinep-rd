# Pruebas E2E y accesibilidad

> Estado: vigente
> Última revisión: 2026-07-27

La suite de navegador no forma parte de `pnpm check`. Los recorridos públicos, autenticados y mutantes se ejecutan mediante comandos y workflows separados para controlar Chromium, credenciales y entorno.

## Preparación inicial

```bash
pnpm test:e2e:install
```

## Portal público local

Configura `.env.local` con las variables normales de Supabase y ejecuta:

```bash
pnpm test:e2e:public
```

Si no existe `E2E_BASE_URL`, Playwright inicia `pnpm dev` en `http://127.0.0.1:3000` y lo detiene al finalizar.

## Entorno ya desplegado

```bash
E2E_BASE_URL=https://entorno-de-prueba.example pnpm test:e2e:public
```

No uses una URL protegida por SSO externo salvo que el navegador de prueba pueda autenticarse en ese SSO.

## Flujo administrativo de importación sin mutaciones

Usa una cuenta de pruebas con el alcance mínimo necesario:

```bash
E2E_ADMIN_EMAIL=usuario-pruebas@example.org \
E2E_ADMIN_PASSWORD='contraseña-de-pruebas' \
pnpm test:e2e:admin
```

La prueba inicia sesión de forma real, pero intercepta únicamente `POST /api/admin/importaciones/preparar`. Valida selección del dominio, lectura del CSV, cálculo del hash, vista previa y resultado persistido simulado sin crear lotes adicionales en Supabase.

## Matriz operativa de acceso

```bash
pnpm test:e2e:access
```

Las credenciales y expectativas se suministran exclusivamente mediante `E2E_ACCESS_PROFILES_JSON`. Antes de instalar Playwright puede validarse el secreto con:

```bash
node scripts/validate-e2e-access-profiles.mjs
```

La matriz completa requiere:

- estados `ready`, `onboarding`, `no_role` y `blocked`;
- un perfil `ready` con navegación `administrator`;
- un perfil `ready` con navegación `viewer`;
- `expectedScopeLabel` en perfiles listos;
- rutas `expectedNavigation.visible`, `hidden` y `readOnly`;
- dos perfiles listos con aislamiento bidireccional A↔B entre `ownEntityId` y `forbiddenEntityId`.

Ejemplo estructural sin credenciales reales:

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
      "visible": ["/admin/nuevo", "/admin/personas"],
      "hidden": ["/admin/configuracion"],
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
      "visible": ["/admin/personas"],
      "hidden": ["/admin/nuevo", "/admin/configuracion"],
      "readOnly": ["/admin/personas"]
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
    "label": "Sin rol",
    "email": "no-role-e2e@example.invalid",
    "password": "REEMPLAZAR_EN_SECRETO",
    "expectedState": "no_role"
  },
  {
    "label": "Bloqueado",
    "email": "blocked-e2e@example.invalid",
    "password": "REEMPLAZAR_EN_SECRETO",
    "expectedState": "blocked"
  }
]
```

La prueba no muta datos ni imprime correos o contraseñas. Comprueba redirección, navegación por rol, etiqueta de alcance, módulos de consulta y visibilidad territorial.

La existencia del secreto no crea cuentas. Deben aprovisionarse previamente cuentas técnicas en un entorno autorizado. La revisión del 2026-07-27 encontró cuentas nacionales activas, pero ninguna asignación con alcance diocesano; por tanto, el aislamiento A↔B sigue bloqueado hasta crear o reasignar dos cuentas técnicas en diócesis distintas.

## Piloto mutante `create + noop` de personas

Este recorrido solo debe ejecutarse contra una rama de desarrollo de Supabase o una base no productiva que pueda restablecerse. Nunca habilites `E2E_ALLOW_MUTATIONS=true` contra producción.

```bash
E2E_BASE_URL=https://entorno-no-productivo.example \
E2E_ADMIN_EMAIL=usuario-pruebas@example.org \
E2E_ADMIN_PASSWORD='contraseña-de-pruebas' \
E2E_ALLOW_MUTATIONS=true \
E2E_PERSON_REFERENCE_CODE=CLERO-000112 \
E2E_PERSON_FIRST_NAME=Agustinus \
E2E_PERSON_LAST_NAME=Panggul \
pnpm test:e2e:admin:mutation
```

La prueba verifica login, preparación, clasificación `create + noop`, aprobación, aplicación transaccional, reporte CSV y repetición idempotente. Los datos creados deben limpiarse mediante el procedimiento administrativo acordado o restaurando una rama efímera; no se borran directamente desde SQL.

## Suite completa

```bash
pnpm test:e2e
```

La suite usa Chromium, trazas y capturas al fallar, Axe WCAG A/AA y reporte HTML en `playwright-report/`.

## GitHub Actions

Los workflows canónicos son:

- `CI`: TypeScript, contratos, pruebas, build y CodeQL;
- `E2E / Public accessibility`: portal público, Axe y evidencia visual;
- `E2E / Admin access matrix`: estados, navegación e aislamiento autenticado.

Para probar un despliegue específico desde `CI`, ejecuta manualmente el workflow con `base_url`. Los artefactos de Playwright se conservan durante 14 días en ese flujo.

## Indexación pública

`E2E / Public accessibility` ejecuta dos variantes:

- `disabled`: `PUBLIC_INDEXING_ENABLED=false` y `PUBLIC_LAUNCH_APPROVED=false`; exige metadata `noindex`, `robots.txt` restrictivo y sitemap vacío;
- `enabled`: ambos valores en `true`; exige metadata indexable, rutas públicas permitidas y fichas navegables en el sitemap.

La indexación real es fail-closed. Ninguna de las dos variables por sí sola abre el portal a buscadores. Durante la beta ambas permanecen en `false`.

Los escaneos automáticos no sustituyen teclado, lector de pantalla, zoom de 400 %, touch, impresión ni pruebas con usuarios.
