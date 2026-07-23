-- Move comanda creation/detail persistence to DB level.
-- Stores purchased products and override-based snapshot prices.

BEGIN;

ALTER TABLE public.comanda
  ADD COLUMN IF NOT EXISTS order_id bigint,
  ADD COLUMN IF NOT EXISTS sede_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';

CREATE INDEX IF NOT EXISTS idx_comanda_order_id ON public.comanda(order_id);
CREATE INDEX IF NOT EXISTS idx_comanda_local_order_id ON public.comanda(local_order_id);

CREATE TABLE IF NOT EXISTS public.comanda_detalle (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comanda_id bigint NOT NULL REFERENCES public.comanda(id) ON DELETE CASCADE,
  orden_id bigint NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  source_table text NOT NULL CHECK (source_table IN ('ordenes_platos', 'ordenes_bebidas', 'ordenes_toppings')),
  source_item_id bigint NOT NULL,
  tipo_producto text NOT NULL CHECK (tipo_producto IN ('plato', 'bebida', 'topping')),
  producto_id bigint NOT NULL,
  producto_nombre text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario integer NOT NULL,
  precio_total integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_item_id)
);

CREATE INDEX IF NOT EXISTS idx_comanda_detalle_comanda_id ON public.comanda_detalle(comanda_id);
CREATE INDEX IF NOT EXISTS idx_comanda_detalle_orden_id ON public.comanda_detalle(orden_id);

CREATE OR REPLACE FUNCTION public.ensure_comanda_for_order(p_order_id bigint)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_comanda_id bigint;
  v_sede_id uuid;
  v_daily_id integer;
BEGIN
  SELECT c.id INTO v_comanda_id
  FROM public.comanda c
  WHERE c.order_id = p_order_id OR c.local_order_id = p_order_id
  ORDER BY c.id
  LIMIT 1;

  IF v_comanda_id IS NOT NULL THEN
    RETURN v_comanda_id;
  END IF;

  SELECT o.sede_id INTO v_sede_id
  FROM public.ordenes o
  WHERE o.id = p_order_id;

  SELECT m.daily_id INTO v_daily_id
  FROM public.minutas m
  WHERE m.order_id = p_order_id
  ORDER BY m.created_at DESC
  LIMIT 1;

  INSERT INTO public.comanda (order_id, local_order_id, delivery_id, daily_id, sede_id, status, created_at)
  VALUES (p_order_id, p_order_id, p_order_id, COALESCE(v_daily_id, p_order_id::integer), v_sede_id, 'open', NOW())
  RETURNING id INTO v_comanda_id;

  RETURN v_comanda_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_comanda_detalle_from_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_comanda_id bigint;
  v_producto_id bigint;
  v_tipo text;
  v_nombre text;
  v_precio integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.comanda_detalle
    WHERE source_table = TG_TABLE_NAME
      AND source_item_id = OLD.id;
    RETURN OLD;
  END IF;

  v_comanda_id := public.ensure_comanda_for_order(NEW.orden_id);
  v_precio := COALESCE(NEW.precio_unitario, 0);

  IF TG_TABLE_NAME = 'ordenes_platos' THEN
    v_tipo := 'plato';
    v_producto_id := NEW.plato_id;
    SELECT COALESCE(p.name, 'Producto ID ' || NEW.plato_id::text) INTO v_nombre
    FROM public.platos p
    WHERE p.id = NEW.plato_id;
  ELSIF TG_TABLE_NAME = 'ordenes_bebidas' THEN
    v_tipo := 'bebida';
    v_producto_id := NEW.bebidas_id;
    SELECT COALESCE(b.name, 'Producto ID ' || NEW.bebidas_id::text) INTO v_nombre
    FROM public.bebidas b
    WHERE b.id = NEW.bebidas_id;
  ELSE
    v_tipo := 'topping';
    v_producto_id := NEW.topping_id;
    SELECT COALESCE(t.name, 'Producto ID ' || NEW.topping_id::text) INTO v_nombre
    FROM public.toppings t
    WHERE t.id = NEW.topping_id;
  END IF;

  INSERT INTO public.comanda_detalle (
    comanda_id,
    orden_id,
    source_table,
    source_item_id,
    tipo_producto,
    producto_id,
    producto_nombre,
    cantidad,
    precio_unitario,
    precio_total
  ) VALUES (
    v_comanda_id,
    NEW.orden_id,
    TG_TABLE_NAME,
    NEW.id,
    v_tipo,
    v_producto_id,
    COALESCE(v_nombre, 'Producto ID ' || v_producto_id::text),
    1,
    v_precio,
    v_precio
  )
  ON CONFLICT (source_table, source_item_id)
  DO UPDATE SET
    comanda_id = EXCLUDED.comanda_id,
    orden_id = EXCLUDED.orden_id,
    tipo_producto = EXCLUDED.tipo_producto,
    producto_id = EXCLUDED.producto_id,
    producto_nombre = EXCLUDED.producto_nombre,
    cantidad = EXCLUDED.cantidad,
    precio_unitario = EXCLUDED.precio_unitario,
    precio_total = EXCLUDED.precio_total;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comanda_detalle_platos ON public.ordenes_platos;
CREATE TRIGGER trg_sync_comanda_detalle_platos
AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_platos
FOR EACH ROW
EXECUTE FUNCTION public.sync_comanda_detalle_from_items();

DROP TRIGGER IF EXISTS trg_sync_comanda_detalle_bebidas ON public.ordenes_bebidas;
CREATE TRIGGER trg_sync_comanda_detalle_bebidas
AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_bebidas
FOR EACH ROW
EXECUTE FUNCTION public.sync_comanda_detalle_from_items();

DROP TRIGGER IF EXISTS trg_sync_comanda_detalle_toppings ON public.ordenes_toppings;
CREATE TRIGGER trg_sync_comanda_detalle_toppings
AFTER INSERT OR UPDATE OR DELETE ON public.ordenes_toppings
FOR EACH ROW
EXECUTE FUNCTION public.sync_comanda_detalle_from_items();

-- Backfill comanda_detalle from historical rows.
INSERT INTO public.comanda_detalle (
  comanda_id,
  orden_id,
  source_table,
  source_item_id,
  tipo_producto,
  producto_id,
  producto_nombre,
  cantidad,
  precio_unitario,
  precio_total
)
SELECT
  public.ensure_comanda_for_order(op.orden_id) AS comanda_id,
  op.orden_id,
  'ordenes_platos' AS source_table,
  op.id AS source_item_id,
  'plato' AS tipo_producto,
  op.plato_id AS producto_id,
  COALESCE(p.name, 'Producto ID ' || op.plato_id::text) AS producto_nombre,
  1 AS cantidad,
  COALESCE(op.precio_unitario, 0) AS precio_unitario,
  COALESCE(op.precio_total, op.precio_unitario, 0) AS precio_total
FROM public.ordenes_platos op
LEFT JOIN public.platos p ON p.id = op.plato_id
ON CONFLICT (source_table, source_item_id) DO NOTHING;

INSERT INTO public.comanda_detalle (
  comanda_id,
  orden_id,
  source_table,
  source_item_id,
  tipo_producto,
  producto_id,
  producto_nombre,
  cantidad,
  precio_unitario,
  precio_total
)
SELECT
  public.ensure_comanda_for_order(ob.orden_id) AS comanda_id,
  ob.orden_id,
  'ordenes_bebidas' AS source_table,
  ob.id AS source_item_id,
  'bebida' AS tipo_producto,
  ob.bebidas_id AS producto_id,
  COALESCE(b.name, 'Producto ID ' || ob.bebidas_id::text) AS producto_nombre,
  1 AS cantidad,
  COALESCE(ob.precio_unitario, 0) AS precio_unitario,
  COALESCE(ob.precio_total, ob.precio_unitario, 0) AS precio_total
FROM public.ordenes_bebidas ob
LEFT JOIN public.bebidas b ON b.id = ob.bebidas_id
ON CONFLICT (source_table, source_item_id) DO NOTHING;

INSERT INTO public.comanda_detalle (
  comanda_id,
  orden_id,
  source_table,
  source_item_id,
  tipo_producto,
  producto_id,
  producto_nombre,
  cantidad,
  precio_unitario,
  precio_total
)
SELECT
  public.ensure_comanda_for_order(ot.orden_id) AS comanda_id,
  ot.orden_id,
  'ordenes_toppings' AS source_table,
  ot.id AS source_item_id,
  'topping' AS tipo_producto,
  ot.topping_id AS producto_id,
  COALESCE(t.name, 'Producto ID ' || ot.topping_id::text) AS producto_nombre,
  1 AS cantidad,
  COALESCE(ot.precio_unitario, 0) AS precio_unitario,
  COALESCE(ot.precio_total, ot.precio_unitario, 0) AS precio_total
FROM public.ordenes_toppings ot
LEFT JOIN public.toppings t ON t.id = ot.topping_id
ON CONFLICT (source_table, source_item_id) DO NOTHING;

COMMIT;
