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

### Aprovisionamiento seguro de cuentas técnicas

Las cuentas se crean mediante la API administrativa oficial de Supabase Auth. No se insertan filas directamente en `auth.users`. El comando requiere una clave `service_role` exclusivamente en el servidor y falla si no se confirma de forma explícita que el destino es un entorno QA autorizado.

Variables por defecto:

- dominio reservado `example.test`;
- entidad A `test-arquidiocesis-ozama`;
- entidad B `test-diocesis-monte-azul`;
- salida `.secrets/e2e-access-profiles.json`, ignorada por Git y con permisos `0600`.

Ejecución:

```bash
E2E_PROVISION_CONFIRM=PROVISION_NON_PRODUCTION_E2E \
pnpm e2e:access:provision
```

El aprovisionador:

1. resuelve las dos diócesis y los roles `diocesan_admin` e `internal_viewer`;
2. crea o actualiza cinco cuentas dedicadas y rota sus contraseñas;
3. configura los cuatro estados de entrada administrativa;
4. reemplaza de forma idempotente las asignaciones de rol;
5. registra la operación en `audit_logs` sin persistir contraseñas;
6. verifica perfiles y alcances antes de generar el JSON protegido.

Después de ejecutarlo:

1. abre **GitHub → Settings → Secrets and variables → Actions**;
2. crea o reemplaza `E2E_ACCESS_PROFILES_JSON` con el contenido completo del archivo generado;
3. elimina el archivo local cuando el secreto haya sido guardado;
4. ejecuta manualmente `E2E / Admin access matrix`.

Nunca ejecutes el aprovisionador contra datos institucionales reales ni habilites `E2E_ALLOW_NON_TEST_ENTITIES=true` sin una decisión de operación registrada. La revisión actual mantiene S7-10 pendiente hasta ejecutar este procedimiento y conservar la evidencia del workflow.

### Suspensión y eliminación de cuentas técnicas

La operación normal después de una ronda E2E es suspender las cuentas y retirar sus roles:

```bash
E2E_DEPROVISION_CONFIRM=DEPROVISION_NON_PRODUCTION_E2E \
pnpm e2e:access:deprovision
```

El modo `suspend` identifica únicamente usuarios marcados con `app_metadata.e2e_access_profile=true` y pertenecientes al dominio reservado configurado. Luego:

1. cambia el perfil a `suspended`;
2. elimina todas sus asignaciones de rol;
3. registra la baja en `audit_logs`;
4. verifica que ninguna cuenta conserve acceso administrativo.

El aprovisionador puede reactivar posteriormente estas mismas cuentas y rotar sus contraseñas. La eliminación física de Supabase Auth es excepcional:

```bash
E2E_DEPROVISION_CONFIRM=DEPROVISION_NON_PRODUCTION_E2E \
E2E_DEPROVISION_MODE=delete \
E2E_DELETE_CONFIRM=DELETE_NON_PRODUCTION_E2E_USERS \
pnpm e2e:access:deprovision
```

La eliminación se ejecuta solo después de suspender el perfil y retirar sus roles. Los tokens de acceso ya emitidos pueden conservar validez criptográfica hasta su expiración; sin embargo, la entrada administrativa de SINEP queda bloqueada por la ausencia de un perfil activo y de asignaciones vigentes. No utilices `delete` como limpieza rutinaria.

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
