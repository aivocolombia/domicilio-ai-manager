-- Crear detalle persistido por item para minutas/comandas.

BEGIN;

CREATE TABLE IF NOT EXISTS public.minuta_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  minuta_id bigint NOT NULL REFERENCES public.minutas(id) ON DELETE CASCADE,
  order_id bigint NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  orden_item_id bigint NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('plato', 'bebida', 'topping')),
  product_id bigint NOT NULL,
  product_name_snapshot text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario_snapshot integer NOT NULL,
  precio_total_snapshot integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, item_type, orden_item_id)
);

CREATE INDEX IF NOT EXISTS idx_minuta_items_minuta_id
  ON public.minuta_items(minuta_id);

CREATE INDEX IF NOT EXISTS idx_minuta_items_order_id
  ON public.minuta_items(order_id);

CREATE INDEX IF NOT EXISTS idx_minuta_items_type_product
  ON public.minuta_items(item_type, product_id);

COMMIT;
