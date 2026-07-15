# `src/features`

`src/features` contiene la implementación funcional por dominio. La convención canónica está documentada en [`docs/architecture/CONVENCION_MODULOS.md`](../../docs/architecture/CONVENCION_MODULOS.md).

Estructura habitual:

```text
src/features/<dominio>/
├── admin/
├── public/
├── components/
├── services/
├── hooks/
├── types/
└── index.ts
```

Reglas locales esenciales:

- `src/app` compone rutas y no contiene I/O de dominio.
- Las pantallas usan servicios tipados y no duplican consultas Supabase.
- Los servicios centralizan RPC, consultas, API y Storage y no renderizan componentes.
- Las piezas reutilizables entre dominios se extraen a las capas compartidas apropiadas.
- No se importan implementaciones desde `src/app` hacia `src/features`.
- Los dominios no crean dependencias circulares.

Ante cualquier discrepancia, aplica la convención canónica enlazada y las pruebas de límites de rutas integradas en `pnpm check`.
