-- PRECHECK (solo lectura)
-- Ejecutar antes de las migraciones para detectar brechas de datos.

-- 1) Registros de sede_* con override nulo
SELECT 'sede_platos' AS tabla, COUNT(*) AS filas_con_override_nulo
FROM public.sede_platos
WHERE price_override IS NULL
UNION ALL
SELECT 'sede_bebidas' AS tabla, COUNT(*) AS filas_con_override_nulo
FROM public.sede_bebidas
WHERE price_override IS NULL
UNION ALL
SELECT 'sede_toppings' AS tabla, COUNT(*) AS filas_con_override_nulo
FROM public.sede_toppings
WHERE price_override IS NULL;

-- 2) Productos sin fila de sede (por sede activa)
SELECT s.id AS sede_id, p.id AS plato_id
FROM public.sedes s
CROSS JOIN public.platos p
LEFT JOIN public.sede_platos sp
  ON sp.sede_id = s.id AND sp.plato_id = p.id
WHERE sp.plato_id IS NULL
LIMIT 200;

SELECT s.id AS sede_id, b.id AS bebida_id
FROM public.sedes s
CROSS JOIN public.bebidas b
LEFT JOIN public.sede_bebidas sb
  ON sb.sede_id = s.id AND sb.bebida_id = b.id
WHERE sb.bebida_id IS NULL
LIMIT 200;

SELECT s.id AS sede_id, t.id AS topping_id
FROM public.sedes s
CROSS JOIN public.toppings t
LEFT JOIN public.sede_toppings st
  ON st.sede_id = s.id AND st.topping_id = t.id
WHERE st.topping_id IS NULL
LIMIT 200;

-- 3) Órdenes legacy sin precio_unitario en detalle
SELECT 'ordenes_platos' AS tabla, COUNT(*) AS filas_sin_precio_unitario
FROM public.ordenes_platos
WHERE precio_unitario IS NULL
UNION ALL
SELECT 'ordenes_bebidas' AS tabla, COUNT(*) AS filas_sin_precio_unitario
FROM public.ordenes_bebidas
WHERE precio_unitario IS NULL
UNION ALL
SELECT 'ordenes_toppings' AS tabla, COUNT(*) AS filas_sin_precio_unitario
FROM public.ordenes_toppings
WHERE precio_unitario IS NULL;

-- 4) Estado de trigger de minutas
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('ordenes', 'minutas')
ORDER BY event_object_table, trigger_name;
