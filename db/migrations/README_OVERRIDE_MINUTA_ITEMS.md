# Checklist manual de ejecución (Supabase SQL Editor)

Ejecutar en este orden, por etapas, validando resultados entre cada paso:

1. `202607180210__01_precheck_override_minuta_items.sql`
2. `202607180211__02_backfill_override_and_order_item_prices.sql`
3. `202607180212__03_constraints_override_not_null.sql`
4. `202607180213__04_create_minuta_items.sql`
5. `202607180214__05_trigger_sync_minuta_items.sql`
6. `202607180216__07_fix_minuta_items_timing.sql`
7. `202607180215__06_post_migration_validations.sql`

## Criterios de aceptación mínimos

- `sede_platos/sede_bebidas/sede_toppings.price_override` sin nulos.
- `ordenes_platos/bebidas/toppings.precio_unitario` y `precio_total` sin nulos.
- `minuta_items` creado con índices.
- trigger `trg_sync_minuta_items_after_insert` activo en `minutas`.
- triggers `trg_sync_minuta_items_from_platos`, `trg_sync_minuta_items_from_bebidas`,
  `trg_sync_minuta_items_from_toppings` activos en `ordenes_*`.
- creación de una orden nueva genera:
  - `minutas` (según trigger existente),
  - filas en `minuta_items` con snapshot de precio por item.

## Rollback sugerido (manual)

- Desactivar trigger de `minuta_items`:
  - `DROP TRIGGER IF EXISTS trg_sync_minuta_items_after_insert ON public.minutas;`
- Eliminar función de sync si se requiere:
  - `DROP FUNCTION IF EXISTS public.sync_minuta_items_for_minuta();`
- Eliminar tabla si fue necesario revertir completamente:
  - `DROP TABLE IF EXISTS public.minuta_items;`

> Nota: no hay rollback automático para backfills de datos; tomar backup previo antes de ejecutar en producción.
