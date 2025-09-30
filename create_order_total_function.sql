-- ===================================================================
-- FUNCIÓN PARA CALCULAR EL TOTAL DE UNA ORDEN
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ===================================================================

-- Función para calcular el total de una orden (productos + envío)
CREATE OR REPLACE FUNCTION calculate_order_total(order_id BIGINT)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
    total_productos DECIMAL(10,2) := 0;
    costo_envio DECIMAL(10,2) := 0;
    total_final DECIMAL(10,2) := 0;
BEGIN
    -- Calcular total de platos
    SELECT COALESCE(SUM(p.pricing), 0) INTO total_productos
    FROM ordenes_platos op
    JOIN platos p ON op.plato_id = p.id
    WHERE op.orden_id = order_id;

    -- Agregar total de bebidas
    SELECT total_productos + COALESCE(SUM(b.pricing), 0) INTO total_productos
    FROM ordenes_bebidas ob
    JOIN bebidas b ON ob.bebidas_id = b.id
    WHERE ob.orden_id = order_id;

    -- Agregar total de toppings
    SELECT total_productos + COALESCE(SUM(t.pricing), 0) INTO total_productos
    FROM ordenes_toppings ot
    JOIN toppings t ON ot.topping_id = t.id
    WHERE ot.orden_id = order_id;

    -- Obtener costo de envío
    SELECT COALESCE(precio_envio, 0) INTO costo_envio
    FROM ordenes
    WHERE id = order_id;

    -- Calcular total final
    total_final := total_productos + costo_envio;

    RETURN total_final;
END;
$$;

-- Ejemplo de uso:
-- SELECT calculate_order_total(123) as total_orden;