-- Fix de sincronización para minuta_items:
-- además del trigger en minutas, sincroniza desde ordenes_* para evitar huecos por timing.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_minuta_items_from_order_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_minuta_id bigint;
  v_order_id bigint;
  v_item_type text;
  v_product_id bigint;
  v_orden_item_id bigint;
  v_product_name text;
  v_precio_unitario integer;
  v_precio_total integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.orden_id;
    v_orden_item_id := OLD.id;
    v_item_type := CASE
      WHEN TG_TABLE_NAME = 'ordenes_platos' THEN 'plato'
      WHEN TG_TABLE_NAME = 'ordenes_bebidas' THEN 'bebida'
      ELSE 'topping'
    END;

    DELETE FROM public.minuta_items
    WHERE order_id = v_order_id
      AND item_type = v_item_type
      AND orden_item_id = v_orden_item_id;

    RETURN OLD;
  END IF;

  v_order_id := NEW.orden_id;
  v_orden_item_id := NEW.id;
  v_precio_unitario := COALESCE(NEW.precio_unitario, 0);
  v_precio_total := COALESCE(NEW.precio_total, v_precio_unitario);

  SELECT m.id
  INTO v_minuta_id
  FROM public.minutas m
  WHERE m.order_id = v_order_id
  ORDER BY m.created_at DESC
  LIMIT 1;

  -- Si todavía no existe la minuta, salir y dejar que el trigger de minutas
  -- haga la carga cuando se cree la fila.
  IF v_minuta_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'ordenes_platos' THEN
    v_item_type := 'plato';
    v_product_id := NEW.plato_id;
    SELECT COALESCE(p.name, 'Producto ID ' || NEW.plato_id::text)
    INTO v_product_name
    FROM public.platos p
    WHERE p.id = NEW.plato_id;
  ELSIF TG_TABLE_NAME = 'ordenes_bebidas' THEN
    v_item_type := 'bebida';
    v_product_id := NEW.bebidas_id;
    SELECT COALESCE(b.name, 'Producto ID ' || NEW.bebidas_id::text)
    INTO v_product_name
    FROM public.bebidas b
    WHERE b.id = NEW.bebidas_id;
  ELSE
    v_item_type := 'topping';
    v_product_id := NEW.topping_id;
    SELECT COALESCE(t.name, 'Producto ID ' || NEW.topping_id::text)
    INTO v_product_name
    FROM public.toppings t
    WHERE t.id = NEW.topping_id;
  END IF;

  INSERT INTO public.minuta_items (
    minuta_id,
    order_id,
    orden_item_id,
    item_type,
    product_id,
    product_name_snapshot,
    cantidad,
    precio_unitario_snapshot,
    precio_total_snapshot
  )
  VALUES (
    v_minuta_id,
    v_order_id,
    v_orden_item_id,
    v_item_type,
    v_product_id,
    COALESCE(v_product_name, 'Producto ID ' || v_product_id::text),
    1,
    v_precio_unitario,
    v_precio_total
  )
  ON CONFLICT (order_id, item_type, orden_item_id)
  DO UPDATE SET
    minuta_id = EXCLUDED.minuta_id,
    product_id = EXCLUDED.product_id,
    product_name_snapshot = EXCLUDED.product_name_snapshot,
    cantidad = EXCLUDED.cantidad,
    precio_unitario_snapshot = EXCLUDED.precio_unitario_snapshot,
    precio_total_snapshot = EXCLUDED.precio_total_snapshot;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_minuta_items_from_platos ON public.ordenes_platos;
CREATE TRIGGER trg_sync_minuta_items_from_platos
AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_platos
FOR EACH ROW
EXECUTE FUNCTION public.sync_minuta_items_from_order_item();

DROP TRIGGER IF EXISTS trg_sync_minuta_items_from_bebidas ON public.ordenes_bebidas;
CREATE TRIGGER trg_sync_minuta_items_from_bebidas
AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_bebidas
FOR EACH ROW
EXECUTE FUNCTION public.sync_minuta_items_from_order_item();

DROP TRIGGER IF EXISTS trg_sync_minuta_items_from_toppings ON public.ordenes_toppings;
CREATE TRIGGER trg_sync_minuta_items_from_toppings
AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_toppings
FOR EACH ROW
EXECUTE FUNCTION public.sync_minuta_items_from_order_item();

-- Reconciliación final por si hubo órdenes creadas en ventana intermedia.
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
