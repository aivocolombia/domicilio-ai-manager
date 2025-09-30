-- =====================================================
-- AGREGAR REGLAS DE SUSTITUCIÓN PARA PLATOS
-- =====================================================

-- Verificar platos existentes
SELECT '=== PLATOS DISPONIBLES ===' as info;
SELECT id, name, pricing FROM platos ORDER BY name;

-- Verificar reglas de sustitución existentes
SELECT '=== REGLAS EXISTENTES ===' as info;
SELECT
    psr.id,
    psr.original_product_type as tipo_original,
    CASE
        WHEN psr.original_product_type = 'plato' THEN p1.name
        WHEN psr.original_product_type = 'topping' THEN t1.name
        WHEN psr.original_product_type = 'bebida' THEN b1.name
    END as producto_original,
    psr.substitute_product_type as tipo_sustituto,
    CASE
        WHEN psr.substitute_product_type = 'plato' THEN p2.name
        WHEN psr.substitute_product_type = 'topping' THEN t2.name
        WHEN psr.substitute_product_type = 'bebida' THEN b2.name
    END as producto_sustituto,
    psr.price_difference,
    psr.is_bidirectional
FROM product_substitution_rules psr
LEFT JOIN platos p1 ON psr.original_product_id = p1.id AND psr.original_product_type = 'plato'
LEFT JOIN toppings t1 ON psr.original_product_id = t1.id AND psr.original_product_type = 'topping'
LEFT JOIN bebidas b1 ON psr.original_product_id = b1.id AND psr.original_product_type = 'bebida'
LEFT JOIN platos p2 ON psr.substitute_product_id = p2.id AND psr.substitute_product_type = 'plato'
LEFT JOIN toppings t2 ON psr.substitute_product_id = t2.id AND psr.substitute_product_type = 'topping'
LEFT JOIN bebidas b2 ON psr.substitute_product_id = b2.id AND psr.substitute_product_type = 'bebida'
WHERE psr.is_active = true
ORDER BY psr.original_product_type, producto_original;

-- Crear reglas de sustitución para platos (ejemplo: entre diferentes tipos de platos)
-- Solo insertar si los platos existen

-- Ejemplo: Ajiaco ↔ Sancocho (si ambos existen)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    ajiaco.id,
    'plato',
    sancocho.id,
    'plato',
    0.00,
    true,
    'Ajiaco ↔ Sancocho (platos similares)'
FROM
    (SELECT id FROM platos WHERE LOWER(name) LIKE '%ajiaco%' LIMIT 1) ajiaco,
    (SELECT id FROM platos WHERE LOWER(name) LIKE '%sancocho%' LIMIT 1) sancocho
WHERE ajiaco.id IS NOT NULL AND sancocho.id IS NOT NULL
ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type) DO NOTHING;

-- Ejemplo: Arroz con pollo → Pollo asado (si ambos existen)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    arroz_pollo.id,
    'plato',
    pollo_asado.id,
    'plato',
    -2000.00,
    false,
    'Arroz con pollo → Pollo asado'
FROM
    (SELECT id FROM platos WHERE LOWER(name) LIKE '%arroz%' AND LOWER(name) LIKE '%pollo%' LIMIT 1) arroz_pollo,
    (SELECT id FROM platos WHERE LOWER(name) LIKE '%pollo%' AND LOWER(name) LIKE '%asado%' LIMIT 1) pollo_asado
WHERE arroz_pollo.id IS NOT NULL AND pollo_asado.id IS NOT NULL
ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type) DO NOTHING;

-- Ejemplo: Bandeja paisa → Frijoles con garra (si ambos existen)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    bandeja.id,
    'plato',
    frijoles.id,
    'plato',
    -5000.00,
    false,
    'Bandeja paisa → Frijoles con garra'
FROM
    (SELECT id FROM platos WHERE LOWER(name) LIKE '%bandeja%' LIMIT 1) bandeja,
    (SELECT id FROM platos WHERE LOWER(name) LIKE '%frijol%' LIMIT 1) frijoles
WHERE bandeja.id IS NOT NULL AND frijoles.id IS NOT NULL
ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type) DO NOTHING;

-- Para permitir sustituciones entre cualquier plato del mismo rango de precio
-- (esto crea muchas reglas automáticamente)

-- Primero crear una función temporal para generar reglas automáticas
CREATE OR REPLACE FUNCTION create_automatic_plato_substitutions()
RETURNS void AS $$
DECLARE
    plato_record RECORD;
    substitute_record RECORD;
    price_diff DECIMAL(10,2);
BEGIN
    -- Iterar sobre todos los platos
    FOR plato_record IN
        SELECT id, name, pricing FROM platos WHERE pricing > 0
    LOOP
        -- Para cada plato, buscar otros platos en rango de precio similar (+/- 10000)
        FOR substitute_record IN
            SELECT id, name, pricing FROM platos
            WHERE pricing > 0
            AND id != plato_record.id
            AND ABS(pricing - plato_record.pricing) <= 10000
        LOOP
            -- Calcular diferencia de precio
            price_diff := substitute_record.pricing - plato_record.pricing;

            -- Insertar regla de sustitución
            INSERT INTO product_substitution_rules
            (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
            VALUES
            (plato_record.id, 'plato', substitute_record.id, 'plato', price_diff, false,
             CONCAT(plato_record.name, ' → ', substitute_record.name, ' (auto-generado)'))
            ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type) DO NOTHING;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Reglas automáticas creadas exitosamente';
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la función para crear reglas automáticas
SELECT create_automatic_plato_substitutions();

-- Eliminar la función temporal
DROP FUNCTION create_automatic_plato_substitutions();

-- Verificar reglas creadas
SELECT '=== REGLAS PARA PLATOS CREADAS ===' as info;
SELECT
    p1.name as plato_original,
    p2.name as plato_sustituto,
    psr.price_difference,
    CASE WHEN psr.is_bidirectional THEN '↔' ELSE '→' END as direccion,
    psr.notes
FROM product_substitution_rules psr
JOIN platos p1 ON psr.original_product_id = p1.id
JOIN platos p2 ON psr.substitute_product_id = p2.id
WHERE psr.original_product_type = 'plato'
AND psr.substitute_product_type = 'plato'
AND psr.is_active = true
ORDER BY p1.name, psr.price_difference;

-- Mensaje final
SELECT 'Reglas de sustitución para platos creadas. Ahora deberías poder cambiar platos en el sistema.' as resultado;