-- Validaciones post-migración (solo lectura).

-- 1) Confirmar overrides obligatorios
SELECT 'sede_platos' AS tabla, COUNT(*) AS null_overrides
FROM public.sede_platos
WHERE price_override IS NULL
UNION ALL
SELECT 'sede_bebidas' AS tabla, COUNT(*) AS null_overrides
FROM public.sede_bebidas
WHERE price_override IS NULL
UNION ALL
SELECT 'sede_toppings' AS tabla, COUNT(*) AS null_overrides
FROM public.sede_toppings
WHERE price_override IS NULL;

-- 2) Confirmar snapshot por item
SELECT 'ordenes_platos' AS tabla, COUNT(*) AS null_precio_unitario
FROM public.ordenes_platos
WHERE precio_unitario IS NULL
UNION ALL
SELECT 'ordenes_bebidas' AS tabla, COUNT(*) AS null_precio_unitario
FROM public.ordenes_bebidas
WHERE precio_unitario IS NULL
UNION ALL
SELECT 'ordenes_toppings' AS tabla, COUNT(*) AS null_precio_unitario
FROM public.ordenes_toppings
WHERE precio_unitario IS NULL;

-- 3) Validar minuta_items poblado
SELECT COUNT(*) AS total_minuta_items FROM public.minuta_items;

SELECT m.id AS minuta_id, m.order_id, COUNT(mi.id) AS items_en_minuta
FROM public.minutas m
LEFT JOIN public.minuta_items mi ON mi.minuta_id = m.id
GROUP BY m.id, m.order_id
ORDER BY m.id DESC
LIMIT 50;

-- 4) Validar triggers presentes
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('minutas', 'platos', 'bebidas', 'toppings', 'ordenes_platos', 'ordenes_bebidas', 'ordenes_toppings')
ORDER BY event_object_table, trigger_name;

-- 5) Muestra de consistencia order vs minuta_items
SELECT
  mi.order_id,
  SUM(mi.precio_total_snapshot) AS total_items_minuta,
  (SELECT COALESCE(SUM(op.precio_total), 0) FROM public.ordenes_platos op WHERE op.orden_id = mi.order_id)
  + (SELECT COALESCE(SUM(ob.precio_total), 0) FROM public.ordenes_bebidas ob WHERE ob.orden_id = mi.order_id)
  + (SELECT COALESCE(SUM(ot.precio_total), 0) FROM public.ordenes_toppings ot WHERE ot.orden_id = mi.order_id)
    AS total_items_orden
FROM public.minuta_items mi
GROUP BY mi.order_id
ORDER BY mi.order_id DESC
LIMIT 100;
