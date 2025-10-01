-- Script para actualizar sustituciones de toppings
-- 1. Cambiar nombres de toppings
-- 2. Agregar nuevas reglas de sustitución

-- ========================================
-- 1. CAMBIAR NOMBRES DE TOPPINGS
-- ========================================

-- Cambiar "Chicharrón" a "Carne en polvo" en tabla toppings
UPDATE toppings
SET nombre = 'Carne en polvo'
WHERE nombre = 'Chicharrón';

-- Cambiar "Plátanitos" a "Mazorca" en tabla toppings
UPDATE toppings
SET nombre = 'Mazorca'
WHERE nombre = 'Plátanitos';

-- ========================================
-- 2. ACTUALIZAR REGLAS DE SUBSTITUCIÓN EXISTENTES
-- ========================================

-- Primero, obtener los IDs de los toppings que necesitamos
DO $$
DECLARE
    arroz_id INTEGER;
    aguacate_id INTEGER;
    platanitos_id INTEGER;
    mazorca_id INTEGER;
BEGIN
    -- Obtener IDs de toppings
    SELECT id INTO arroz_id FROM toppings WHERE nombre = 'Arroz';
    SELECT id INTO aguacate_id FROM toppings WHERE nombre = 'Aguacate';
    SELECT id INTO platanitos_id FROM toppings WHERE nombre = 'Plátanitos';
    SELECT id INTO mazorca_id FROM toppings WHERE nombre = 'Mazorca';

    -- Verificar que existen los toppings
    IF arroz_id IS NULL THEN
        RAISE NOTICE 'No se encontró topping "Arroz"';
    END IF;

    IF aguacate_id IS NULL THEN
        RAISE NOTICE 'No se encontró topping "Aguacate"';
    END IF;

    IF platanitos_id IS NULL THEN
        RAISE NOTICE 'No se encontró topping "Plátanitos"';
    END IF;

    -- ========================================
    -- 3. AGREGAR NUEVAS REGLAS DE SUSTITUCIÓN
    -- ========================================

    -- Agregar regla: Arroz -> Plátanitos (si existe Plátanitos)
    IF arroz_id IS NOT NULL AND platanitos_id IS NOT NULL THEN
        INSERT INTO substitution_rules (
            original_product_id,
            original_product_type,
            substitute_product_id,
            substitute_product_type,
            price_difference,
            is_bidirectional
        ) VALUES (
            arroz_id,
            'topping',
            platanitos_id,
            'topping',
            0, -- Sin diferencia de precio
            true
        )
        ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type)
        DO UPDATE SET
            price_difference = 0,
            is_bidirectional = true;

        RAISE NOTICE 'Regla agregada: Arroz -> Plátanitos';
    END IF;

    -- Agregar regla: Aguacate -> Plátanitos (si existe Plátanitos)
    IF aguacate_id IS NOT NULL AND platanitos_id IS NOT NULL THEN
        INSERT INTO substitution_rules (
            original_product_id,
            original_product_type,
            substitute_product_id,
            substitute_product_type,
            price_difference,
            is_bidirectional
        ) VALUES (
            aguacate_id,
            'topping',
            platanitos_id,
            'topping',
            0, -- Sin diferencia de precio
            true
        )
        ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type)
        DO UPDATE SET
            price_difference = 0,
            is_bidirectional = true;

        RAISE NOTICE 'Regla agregada: Aguacate -> Plátanitos';
    END IF;

    -- Agregar regla: Arroz -> Mazorca (nueva mazorca)
    IF arroz_id IS NOT NULL AND mazorca_id IS NOT NULL THEN
        INSERT INTO substitution_rules (
            original_product_id,
            original_product_type,
            substitute_product_id,
            substitute_product_type,
            price_difference,
            is_bidirectional
        ) VALUES (
            arroz_id,
            'topping',
            mazorca_id,
            'topping',
            0, -- Sin diferencia de precio
            true
        )
        ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type)
        DO UPDATE SET
            price_difference = 0,
            is_bidirectional = true;

        RAISE NOTICE 'Regla agregada: Arroz -> Mazorca';
    END IF;

    -- Agregar regla: Aguacate -> Mazorca (nueva mazorca)
    IF aguacate_id IS NOT NULL AND mazorca_id IS NOT NULL THEN
        INSERT INTO substitution_rules (
            original_product_id,
            original_product_type,
            substitute_product_id,
            substitute_product_type,
            price_difference,
            is_bidirectional
        ) VALUES (
            aguacate_id,
            'topping',
            mazorca_id,
            'topping',
            0, -- Sin diferencia de precio
            true
        )
        ON CONFLICT (original_product_id, original_product_type, substitute_product_id, substitute_product_type)
        DO UPDATE SET
            price_difference = 0,
            is_bidirectional = true;

        RAISE NOTICE 'Regla agregada: Aguacate -> Mazorca';
    END IF;

END $$;

-- ========================================
-- 4. VERIFICAR RESULTADOS
-- ========================================

-- Mostrar toppings actualizados
SELECT 'TOPPINGS ACTUALIZADOS:' as info;
SELECT id, nombre FROM toppings WHERE nombre IN ('Carne en polvo', 'Mazorca', 'Plátanitos', 'Arroz', 'Aguacate') ORDER BY nombre;

-- Mostrar reglas de sustitución con los nuevos toppings
SELECT 'REGLAS DE SUSTITUCIÓN:' as info;
SELECT
    sr.id,
    t1.nombre as original_topping,
    t2.nombre as substitute_topping,
    sr.price_difference,
    sr.is_bidirectional
FROM substitution_rules sr
JOIN toppings t1 ON sr.original_product_id = t1.id AND sr.original_product_type = 'topping'
JOIN toppings t2 ON sr.substitute_product_id = t2.id AND sr.substitute_product_type = 'topping'
WHERE t1.nombre IN ('Arroz', 'Aguacate') OR t2.nombre IN ('Plátanitos', 'Mazorca')
ORDER BY t1.nombre, t2.nombre;