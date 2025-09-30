-- =====================================================
-- ARREGLAR FUNCIÓN DE SUSTITUCIONES
-- =====================================================

-- Eliminar función existente
DROP FUNCTION IF EXISTS get_available_substitutions(INTEGER, VARCHAR(20));

-- Crear función corregida
CREATE OR REPLACE FUNCTION get_available_substitutions(
    p_product_id INTEGER,
    p_product_type VARCHAR(20)
)
RETURNS TABLE (
    substitute_id INTEGER,
    substitute_type VARCHAR(20),
    substitute_name TEXT,
    price_difference DECIMAL(10,2),
    is_bidirectional BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    -- Reglas directas (A → B)
    SELECT
        psr.substitute_product_id as substitute_id,
        psr.substitute_product_type as substitute_type,
        CASE
            WHEN psr.substitute_product_type = 'topping' THEN t.name::TEXT
            WHEN psr.substitute_product_type = 'plato' THEN p.name::TEXT
            WHEN psr.substitute_product_type = 'bebida' THEN b.name::TEXT
            ELSE 'Producto desconocido'::TEXT
        END as substitute_name,
        psr.price_difference,
        psr.is_bidirectional
    FROM product_substitution_rules psr
    LEFT JOIN toppings t ON psr.substitute_product_id = t.id AND psr.substitute_product_type = 'topping'
    LEFT JOIN platos p ON psr.substitute_product_id = p.id AND psr.substitute_product_type = 'plato'
    LEFT JOIN bebidas b ON psr.substitute_product_id = b.id AND psr.substitute_product_type = 'bebida'
    WHERE psr.original_product_id = p_product_id
      AND psr.original_product_type = p_product_type
      AND psr.is_active = true

    UNION

    -- Reglas bidireccionales inversas (B ← A cuando es bidireccional)
    SELECT
        psr.original_product_id as substitute_id,
        psr.original_product_type as substitute_type,
        CASE
            WHEN psr.original_product_type = 'topping' THEN t.name::TEXT
            WHEN psr.original_product_type = 'plato' THEN p.name::TEXT
            WHEN psr.original_product_type = 'bebida' THEN b.name::TEXT
            ELSE 'Producto desconocido'::TEXT
        END as substitute_name,
        -psr.price_difference as price_difference,
        psr.is_bidirectional
    FROM product_substitution_rules psr
    LEFT JOIN toppings t ON psr.original_product_id = t.id AND psr.original_product_type = 'topping'
    LEFT JOIN platos p ON psr.original_product_id = p.id AND psr.original_product_type = 'plato'
    LEFT JOIN bebidas b ON psr.original_product_id = b.id AND psr.original_product_type = 'bebida'
    WHERE psr.substitute_product_id = p_product_id
      AND psr.substitute_product_type = p_product_type
      AND psr.is_active = true
      AND psr.is_bidirectional = true;
END;
$$ LANGUAGE plpgsql;

-- Crear reglas de sustitución simples para platos
-- Solo entre platos del mismo precio o precio similar

-- Ajiaco ↔ Frijoles (mismo precio $24,000)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, is_active, notes)
VALUES
(1, 'plato', 2, 'plato', 0.00, true, true, 'Ajiaco ↔ Frijoles ($24,000)')
ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type) DO NOTHING;

-- Bandeja → Ajiaco (precio mayor a menor)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, is_active, notes)
VALUES
(4, 'plato', 1, 'plato', -26000.00, false, true, 'Bandeja ($50,000) → Ajiaco ($24,000)')
ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type) DO NOTHING;

-- Bandeja → Frijoles (precio mayor a menor)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, is_active, notes)
VALUES
(4, 'plato', 2, 'plato', -26000.00, false, true, 'Bandeja ($50,000) → Frijoles ($24,000)')
ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type) DO NOTHING;

-- Verificar que se crearon las reglas
SELECT
    'Reglas creadas:' as info,
    p1.name as plato_original,
    CASE WHEN psr.is_bidirectional THEN '↔' ELSE '→' END as direccion,
    p2.name as plato_sustituto,
    psr.price_difference as diferencia_precio,
    psr.notes
FROM product_substitution_rules psr
JOIN platos p1 ON psr.original_product_id = p1.id AND psr.original_product_type = 'plato'
JOIN platos p2 ON psr.substitute_product_id = p2.id AND psr.substitute_product_type = 'plato'
WHERE psr.is_active = true
ORDER BY p1.name;

-- Probar la función
SELECT 'Sustituciones para Ajiaco (ID 1):' as info;
SELECT * FROM get_available_substitutions(1, 'plato');

SELECT 'Sustituciones para Frijoles (ID 2):' as info;
SELECT * FROM get_available_substitutions(2, 'plato');

SELECT 'Sustituciones para Bandeja (ID 4):' as info;
SELECT * FROM get_available_substitutions(4, 'plato');