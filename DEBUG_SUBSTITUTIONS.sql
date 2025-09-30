-- ===================================================================
-- DEBUG: VERIFICAR SUSTITUCIONES EN BASE DE DATOS
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ===================================================================

-- Ver las sustituciones más recientes con sus orden_item_id
SELECT
    id,
    orden_id,
    item_type,
    item_id,
    orden_item_id,
    substitution_type,
    original_name,
    substitute_name,
    price_difference,
    parent_item_name,
    applied_at
FROM order_substitution_history
WHERE orden_id = 494  -- Cambiar por el ID de la orden que estás probando
ORDER BY applied_at DESC;

-- Ver items de la orden 494 para comparar IDs
SELECT 'platos' as tipo, id, plato_id, NULL as bebidas_id, NULL as topping_id
FROM ordenes_platos
WHERE orden_id = 494

UNION ALL

SELECT 'bebidas' as tipo, id, NULL as plato_id, bebidas_id, NULL as topping_id
FROM ordenes_bebidas
WHERE orden_id = 494

UNION ALL

SELECT 'toppings' as tipo, id, NULL as plato_id, NULL as bebidas_id, topping_id
FROM ordenes_toppings
WHERE orden_id = 494

ORDER BY tipo, id;