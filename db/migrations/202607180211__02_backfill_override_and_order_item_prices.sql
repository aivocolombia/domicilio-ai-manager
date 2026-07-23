-- Backfill de override y precios históricos por item.

BEGIN;

-- Asegurar columnas históricas por item
ALTER TABLE public.ordenes_platos
  ADD COLUMN IF NOT EXISTS precio_unitario integer,
  ADD COLUMN IF NOT EXISTS precio_total integer;

ALTER TABLE public.ordenes_bebidas
  ADD COLUMN IF NOT EXISTS precio_unitario integer,
  ADD COLUMN IF NOT EXISTS precio_total integer;

ALTER TABLE public.ordenes_toppings
  ADD COLUMN IF NOT EXISTS precio_unitario integer,
  ADD COLUMN IF NOT EXISTS precio_total integer;

-- Crear filas faltantes en sede_* para todos los productos/sedes
INSERT INTO public.sede_platos (sede_id, plato_id, available, price_override, updated_at)
SELECT s.id, p.id, true, COALESCE(p.pricing, 0), NOW()
FROM public.sedes s
CROSS JOIN public.platos p
ON CONFLICT (sede_id, plato_id) DO NOTHING;

INSERT INTO public.sede_bebidas (sede_id, bebida_id, available, price_override, updated_at)
SELECT s.id, b.id, true, COALESCE(b.pricing, 0), NOW()
FROM public.sedes s
CROSS JOIN public.bebidas b
ON CONFLICT (sede_id, bebida_id) DO NOTHING;

INSERT INTO public.sede_toppings (sede_id, topping_id, available, price_override, updated_at)
SELECT s.id, t.id, true, COALESCE(t.pricing, 0), NOW()
FROM public.sedes s
CROSS JOIN public.toppings t
ON CONFLICT (sede_id, topping_id) DO NOTHING;

-- Backfill de override si está null
UPDATE public.sede_platos sp
SET price_override = COALESCE(sp.price_override, p.pricing, 0)
FROM public.platos p
WHERE p.id = sp.plato_id
  AND sp.price_override IS NULL;

UPDATE public.sede_bebidas sb
SET price_override = COALESCE(sb.price_override, b.pricing, 0)
FROM public.bebidas b
WHERE b.id = sb.bebida_id
  AND sb.price_override IS NULL;

UPDATE public.sede_toppings st
SET price_override = COALESCE(st.price_override, t.pricing, 0)
FROM public.toppings t
WHERE t.id = st.topping_id
  AND st.price_override IS NULL;

-- Backfill de precios unitarios/totales por item usando override de la sede de la orden
UPDATE public.ordenes_platos op
SET
  precio_unitario = COALESCE(op.precio_unitario, sp.price_override, 0),
  precio_total = COALESCE(op.precio_total, COALESCE(op.precio_unitario, sp.price_override, 0))
FROM public.ordenes o
LEFT JOIN public.sede_platos sp
  ON sp.sede_id = o.sede_id
 AND sp.plato_id = op.plato_id
WHERE o.id = op.orden_id
  AND (op.precio_unitario IS NULL OR op.precio_total IS NULL);

UPDATE public.ordenes_bebidas ob
SET
  precio_unitario = COALESCE(ob.precio_unitario, sb.price_override, 0),
  precio_total = COALESCE(ob.precio_total, COALESCE(ob.precio_unitario, sb.price_override, 0))
FROM public.ordenes o
LEFT JOIN public.sede_bebidas sb
  ON sb.sede_id = o.sede_id
 AND sb.bebida_id = ob.bebidas_id
WHERE o.id = ob.orden_id
  AND (ob.precio_unitario IS NULL OR ob.precio_total IS NULL);

UPDATE public.ordenes_toppings ot
SET
  precio_unitario = COALESCE(ot.precio_unitario, st.price_override, 0),
  precio_total = COALESCE(ot.precio_total, COALESCE(ot.precio_unitario, st.price_override, 0))
FROM public.ordenes o
LEFT JOIN public.sede_toppings st
  ON st.sede_id = o.sede_id
 AND st.topping_id = ot.topping_id
WHERE o.id = ot.orden_id
  AND (ot.precio_unitario IS NULL OR ot.precio_total IS NULL);

COMMIT;
