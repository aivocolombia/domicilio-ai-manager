-- =====================================================
-- SCRIPT COMPLETO PARA SUSTITUCIONES DE PRODUCTOS
-- EJECUTAR PASO A PASO EN SUPABASE SQL EDITOR
-- =====================================================

-- PASO 1: CREAR TABLA DE SUSTITUCIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS product_substitution_rules (
    id SERIAL PRIMARY KEY,
    original_product_id INTEGER NOT NULL,
    original_product_type VARCHAR(20) NOT NULL CHECK (original_product_type IN ('plato', 'bebida', 'topping')),
    substitute_product_id INTEGER NOT NULL,
    substitute_product_type VARCHAR(20) NOT NULL CHECK (substitute_product_type IN ('plato', 'bebida', 'topping')),
    price_difference DECIMAL(10,2) DEFAULT 0.00,
    is_bidirectional BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PASO 2: CREAR ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_substitution_original ON product_substitution_rules(original_product_id, original_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_substitute ON product_substitution_rules(substitute_product_id, substitute_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_active ON product_substitution_rules(is_active);

-- PASO 3: CONSTRAINT ÚNICO
-- =====================================================
-- Intentar agregar constraint único (ignorar error si ya existe)
DO $$
BEGIN
    BEGIN
        ALTER TABLE product_substitution_rules
        ADD CONSTRAINT unique_substitution_rule
        UNIQUE (original_product_id, original_product_type, substitute_product_id, substitute_product_type);
    EXCEPTION
        WHEN duplicate_object THEN
            -- El constraint ya existe, ignorar
            NULL;
    END;
END $$;

-- PASO 4: VERIFICAR PRODUCTOS EXISTENTES
-- =====================================================
-- ¡EJECUTA ESTO PRIMERO! Anota los IDs que obtengas

SELECT '=== TOPPINGS RELEVANTES ===' as info;
SELECT id, name FROM toppings
WHERE LOWER(name) LIKE '%mazorca%'
   OR LOWER(name) LIKE '%plátano%'
   OR LOWER(name) LIKE '%platano%'
   OR LOWER(name) LIKE '%arroz%'
   OR LOWER(name) LIKE '%aguacate%'
   OR LOWER(name) LIKE '%carne%'
   OR LOWER(name) LIKE '%tocino%'
   OR LOWER(name) LIKE '%pollo%'
ORDER BY name;

SELECT '=== PLATOS RELEVANTES ===' as info;
SELECT id, name FROM platos
WHERE LOWER(name) LIKE '%porción%'
   OR LOWER(name) LIKE '%porcion%'
   OR LOWER(name) LIKE '%carne%'
   OR LOWER(name) LIKE '%pollo%'
ORDER BY name;

-- PASO 5: INSERTAR REGLAS CON IDs REALES
-- =====================================================
-- ⚠️ IMPORTANTE: Reemplaza los números con los IDs reales que obtuviste arriba

-- INSTRUCCIONES:
-- 1. Busca en los resultados de arriba el ID de cada producto
-- 2. Reemplaza los números XX con los IDs reales
-- 3. Si un producto no existe, comenta esa regla (agregar -- al inicio)

-- Regla 1: Mazorca ↔ Plátano ($3,700) - BIDIRECCIONAL
-- Busca ID de "mazorca" y "plátano" en la lista de arriba
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    mazorca.id,
    'topping',
    platano.id,
    'topping',
    0.00,
    true,
    'Mazorca ↔ Plátano ($3,700)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%mazorca%' LIMIT 1) mazorca,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%plátano%' OR LOWER(name) LIKE '%platano%' LIMIT 1) platano
WHERE mazorca.id IS NOT NULL AND platano.id IS NOT NULL;

-- Regla 2: Arroz → Aguacate ($4,800 → $4,200)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    arroz.id,
    'topping',
    aguacate.id,
    'topping',
    -600.00,
    false,
    'Arroz ($4,800) → Aguacate ($4,200)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%arroz%' LIMIT 1) arroz,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%aguacate%' LIMIT 1) aguacate
WHERE arroz.id IS NOT NULL AND aguacate.id IS NOT NULL;

-- Regla 3: Arroz → Plátano ($4,800 → $3,700)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    arroz.id,
    'topping',
    platano.id,
    'topping',
    -1100.00,
    false,
    'Arroz ($4,800) → Plátano ($3,700)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%arroz%' LIMIT 1) arroz,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%plátano%' OR LOWER(name) LIKE '%platano%' LIMIT 1) platano
WHERE arroz.id IS NOT NULL AND platano.id IS NOT NULL;

-- Regla 4: Arroz → Mazorca ($4,800 → $3,700)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    arroz.id,
    'topping',
    mazorca.id,
    'topping',
    -1100.00,
    false,
    'Arroz ($4,800) → Mazorca ($3,700)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%arroz%' LIMIT 1) arroz,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%mazorca%' LIMIT 1) mazorca
WHERE arroz.id IS NOT NULL AND mazorca.id IS NOT NULL;

-- Regla 5: Porción carne ↔ Porción pollo ($6,300) - BIDIRECCIONAL
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    carne.id,
    'topping',
    pollo.id,
    'topping',
    0.00,
    true,
    'Porción carne ↔ Porción pollo ($6,300)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%carne%' LIMIT 1) carne,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%pollo%' LIMIT 1) pollo
WHERE carne.id IS NOT NULL AND pollo.id IS NOT NULL;

-- Regla 6: Tocino → Porción carne ($8,400 → $6,300)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    tocino.id,
    'topping',
    carne.id,
    'topping',
    -2100.00,
    false,
    'Tocino ($8,400) → Porción carne ($6,300)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%tocino%' LIMIT 1) tocino,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%carne%' LIMIT 1) carne
WHERE tocino.id IS NOT NULL AND carne.id IS NOT NULL;

-- Regla 7: Aguacate → Mazorca ($4,200 → $3,700)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    aguacate.id,
    'topping',
    mazorca.id,
    'topping',
    -500.00,
    false,
    'Aguacate ($4,200) → Mazorca ($3,700)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%aguacate%' LIMIT 1) aguacate,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%mazorca%' LIMIT 1) mazorca
WHERE aguacate.id IS NOT NULL AND mazorca.id IS NOT NULL;

-- Regla 8: Aguacate → Plátano ($4,200 → $3,700)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
SELECT
    aguacate.id,
    'topping',
    platano.id,
    'topping',
    -500.00,
    false,
    'Aguacate ($4,200) → Plátano ($3,700)'
FROM
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%aguacate%' LIMIT 1) aguacate,
    (SELECT id FROM toppings WHERE LOWER(name) LIKE '%plátano%' OR LOWER(name) LIKE '%platano%' LIMIT 1) platano
WHERE aguacate.id IS NOT NULL AND platano.id IS NOT NULL;

-- PASO 6: VERIFICAR REGLAS INSERTADAS
-- =====================================================
SELECT
    psr.id,
    t1.name as producto_original,
    '→' as flecha,
    t2.name as producto_sustituto,
    psr.price_difference as diferencia_precio,
    CASE WHEN psr.is_bidirectional THEN '↔' ELSE '→' END as tipo,
    psr.notes
FROM product_substitution_rules psr
JOIN toppings t1 ON psr.original_product_id = t1.id
JOIN toppings t2 ON psr.substitute_product_id = t2.id
WHERE psr.is_active = true
ORDER BY psr.id;

-- PASO 7: CREAR FUNCIÓN PARA OBTENER SUSTITUCIONES
-- =====================================================
CREATE OR REPLACE FUNCTION get_available_substitutions(
    p_product_id INTEGER,
    p_product_type VARCHAR(20)
)
RETURNS TABLE (
    substitute_id INTEGER,
    substitute_type VARCHAR(20),
    substitute_name VARCHAR(255),
    price_difference DECIMAL(10,2),
    is_bidirectional BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    -- Sustituciones directas
    SELECT
        psr.substitute_product_id as substitute_id,
        psr.substitute_product_type as substitute_type,
        CASE
            WHEN psr.substitute_product_type = 'topping' THEN t.name
            WHEN psr.substitute_product_type = 'plato' THEN p.name
            WHEN psr.substitute_product_type = 'bebida' THEN b.name
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

    -- Sustituciones bidireccionales (inversas)
    SELECT
        psr.original_product_id as substitute_id,
        psr.original_product_type as substitute_type,
        CASE
            WHEN psr.original_product_type = 'topping' THEN t.name
            WHEN psr.original_product_type = 'plato' THEN p.name
            WHEN psr.original_product_type = 'bebida' THEN b.name
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

-- PASO 8: CONFIGURAR PERMISOS RLS
-- =====================================================
ALTER TABLE product_substitution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read substitution rules" ON product_substitution_rules
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage substitution rules" ON product_substitution_rules
    FOR ALL
    TO authenticated
    USING (true);

-- PASO 9: HABILITAR REALTIME (OPCIONAL)
-- =====================================================
-- Descomenta si quieres que los cambios se reflejen en tiempo real
-- ALTER PUBLICATION supabase_realtime ADD TABLE product_substitution_rules;

-- PASO 10: PROBAR LA FUNCIÓN
-- =====================================================
-- Ejemplo: obtener sustituciones para un producto
-- Reemplaza el número con un ID real que hayas obtenido arriba

-- Ejemplo (reemplaza 1 con un ID real):
-- SELECT * FROM get_available_substitutions(1, 'topping');

-- =====================================================
-- INSTRUCCIONES DE EJECUCIÓN:
-- =====================================================
/*
1. Ejecuta PASO 1-3 para crear la tabla
2. Ejecuta PASO 4 para ver productos disponibles
3. Anota los IDs que obtengas
4. Ejecuta PASO 5 (las reglas se insertan automáticamente solo si existen ambos productos)
5. Ejecuta PASO 6 para verificar qué reglas se crearon
6. Ejecuta PASO 7-8 para función y permisos
7. Prueba con PASO 10

Si alguna regla no se inserta, significa que ese producto no existe en tu base de datos.
*/