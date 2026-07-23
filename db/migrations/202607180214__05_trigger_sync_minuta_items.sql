-- Poblar minuta_items automáticamente al crear minutas.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_minuta_items_for_minuta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Platos
  INSERT INTO public.minuta_items (
    minuta_id, order_id, orden_item_id, item_type, product_id, product_name_snapshot,
    cantidad, precio_unitario_snapshot, precio_total_snapshot
  )
  SELECT
    NEW.id,
    NEW.order_id,
    op.id,
    'plato',
    op.plato_id,
    COALESCE(p.name, 'Producto ID ' || op.plato_id::text),
    1,
    COALESCE(op.precio_unitario, 0),
    COALESCE(op.precio_total, op.precio_unitario, 0)
  FROM public.ordenes_platos op
  LEFT JOIN public.platos p ON p.id = op.plato_id
  WHERE op.orden_id = NEW.order_id
  ON CONFLICT (order_id, item_type, orden_item_id) DO NOTHING;

  -- Bebidas
  INSERT INTO public.minuta_items (
    minuta_id, order_id, orden_item_id, item_type, product_id, product_name_snapshot,
    cantidad, precio_unitario_snapshot, precio_total_snapshot
  )
  SELECT
    NEW.id,
    NEW.order_id,
    ob.id,
    'bebida',
    ob.bebidas_id,
    COALESCE(b.name, 'Producto ID ' || ob.bebidas_id::text),
    1,
    COALESCE(ob.precio_unitario, 0),
    COALESCE(ob.precio_total, ob.precio_unitario, 0)
  FROM public.ordenes_bebidas ob
  LEFT JOIN public.bebidas b ON b.id = ob.bebidas_id
  WHERE ob.orden_id = NEW.order_id
  ON CONFLICT (order_id, item_type, orden_item_id) DO NOTHING;

  -- Toppings
  INSERT INTO public.minuta_items (
    minuta_id, order_id, orden_item_id, item_type, product_id, product_name_snapshot,
    cantidad, precio_unitario_snapshot, precio_total_snapshot
  )
  SELECT
    NEW.id,
    NEW.order_id,
    ot.id,
    'topping',
    ot.topping_id,
    COALESCE(t.name, 'Producto ID ' || ot.topping_id::text),
    1,
    COALESCE(ot.precio_unitario, 0),
    COALESCE(ot.precio_total, ot.precio_unitario, 0)
  FROM public.ordenes_toppings ot
  LEFT JOIN public.toppings t ON t.id = ot.topping_id
  WHERE ot.orden_id = NEW.order_id
  ON CONFLICT (order_id, item_type, orden_item_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_minuta_items_after_insert ON public.minutas;
CREATE TRIGGER trg_sync_minuta_items_after_insert
AFTER INSERT ON public.minutas
FOR EACH ROW
EXECUTE FUNCTION public.sync_minuta_items_for_minuta();

-- Backfill opcional: poblar minuta_items para minutas existentes
INSERT INTO public.minuta_items (
  minuta_id, order_id, orden_item_id, item_type, product_id, product_name_snapshot,
  cantidad, precio_unitario_snapshot, precio_total_snapshot
)
SELECT
  m.id, m.order_id, op.id, 'plato', op.plato_id,
  COALESCE(p.name, 'Producto ID ' || op.plato_id::text),
  1, COALESCE(op.precio_unitario, 0), COALESCE(op.precio_total, op.precio_unitario, 0)
FROM public.minutas m
JOIN public.ordenes_platos op ON op.orden_id = m.order_id
LEFT JOIN public.platos p ON p.id = op.plato_id
ON CONFLICT (order_id, item_type, orden_item_id) DO NOTHING;

INSERT INTO public.minuta_items (
  minuta_id, order_id, orden_item_id, item_type, product_id, product_name_snapshot,
  cantidad, precio_unitario_snapshot, precio_total_snapshot
)
SELECT
  m.id, m.order_id, ob.id, 'bebida', ob.bebidas_id,
  COALESCE(b.name, 'Producto ID ' || ob.bebidas_id::text),
  1, COALESCE(ob.precio_unitario, 0), COALESCE(ob.precio_total, ob.precio_unitario, 0)
FROM public.minutas m
JOIN public.ordenes_bebidas ob ON ob.orden_id = m.order_id
LEFT JOIN public.bebidas b ON b.id = ob.bebidas_id
ON CONFLICT (order_id, item_type, orden_item_id) DO NOTHING;

INSERT INTO public.minuta_items (
  minuta_id, order_id, orden_item_id, item_type, product_id, product_name_snapshot,
  cantidad, precio_unitario_snapshot, precio_total_snapshot
)
SELECT
  m.id, m.order_id, ot.id, 'topping', ot.topping_id,
  COALESCE(t.name, 'Producto ID ' || ot.topping_id::text),
  1, COALESCE(ot.precio_unitario, 0), COALESCE(ot.precio_total, ot.precio_unitario, 0)
FROM public.minutas m
JOIN public.ordenes_toppings ot ON ot.orden_id = m.order_id
LEFT JOIN public.toppings t ON t.id = ot.topping_id
ON CONFLICT (order_id, item_type, orden_item_id) DO NOTHING;

COMMIT;
