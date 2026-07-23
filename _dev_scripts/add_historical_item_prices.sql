-- Congela precios por item en las tablas de detalle de orden
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.ordenes_platos
  ADD COLUMN IF NOT EXISTS precio_unitario integer,
  ADD COLUMN IF NOT EXISTS precio_total integer;

ALTER TABLE public.ordenes_bebidas
  ADD COLUMN IF NOT EXISTS precio_unitario integer,
  ADD COLUMN IF NOT EXISTS precio_total integer;

ALTER TABLE public.ordenes_toppings
  ADD COLUMN IF NOT EXISTS precio_unitario integer,
  ADD COLUMN IF NOT EXISTS precio_total integer;

-- Backfill para órdenes existentes (usa precio de sede actual si existe, sino base)
UPDATE public.ordenes_platos op
SET
  precio_unitario = COALESCE(op.precio_unitario, sp.price_override, p.pricing, 0),
  precio_total = COALESCE(op.precio_total, COALESCE(op.precio_unitario, sp.price_override, p.pricing, 0))
FROM public.ordenes o
LEFT JOIN public.sede_platos sp
  ON sp.sede_id = o.sede_id
 AND sp.plato_id = op.plato_id
LEFT JOIN public.platos p
  ON p.id = op.plato_id
WHERE o.id = op.orden_id
  AND (op.precio_unitario IS NULL OR op.precio_total IS NULL);

UPDATE public.ordenes_bebidas ob
SET
  precio_unitario = COALESCE(ob.precio_unitario, sb.price_override, b.pricing, 0),
  precio_total = COALESCE(ob.precio_total, COALESCE(ob.precio_unitario, sb.price_override, b.pricing, 0))
FROM public.ordenes o
LEFT JOIN public.sede_bebidas sb
  ON sb.sede_id = o.sede_id
 AND sb.bebida_id = ob.bebidas_id
LEFT JOIN public.bebidas b
  ON b.id = ob.bebidas_id
WHERE o.id = ob.orden_id
  AND (ob.precio_unitario IS NULL OR ob.precio_total IS NULL);

UPDATE public.ordenes_toppings ot
SET
  precio_unitario = COALESCE(ot.precio_unitario, st.price_override, t.pricing, 0),
  precio_total = COALESCE(ot.precio_total, COALESCE(ot.precio_unitario, st.price_override, t.pricing, 0))
FROM public.ordenes o
LEFT JOIN public.sede_toppings st
  ON st.sede_id = o.sede_id
 AND st.topping_id = ot.topping_id
LEFT JOIN public.toppings t
  ON t.id = ot.topping_id
WHERE o.id = ot.orden_id
  AND (ot.precio_unitario IS NULL OR ot.precio_total IS NULL);
