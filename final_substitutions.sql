-- =====================================================
-- SCRIPT FINAL PARA SUSTITUCIONES (COMPLETAMENTE FUNCIONAL)
-- =====================================================

-- PASO 1: CREAR TABLA DE SUSTITUCIONES
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

-- PASO 2: CREAR ÍNDICES (ignorar errores si ya existen)
CREATE INDEX IF NOT EXISTS idx_substitution_original ON product_substitution_rules(original_product_id, original_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_substitute ON product_substitution_rules(substitute_product_id, substitute_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_active ON product_substitution_rules(is_active);

-- PASO 3: CONSTRAINT ÚNICO (usar DO block para manejar errores)
DO $$
BEGIN
    BEGIN
        ALTER TABLE product_substitution_rules
        ADD CONSTRAINT unique_substitution_rule
        UNIQUE (original_product_id, original_product_type, substitute_product_id, substitute_product_type);
    EXCEPTION
        WHEN duplicate_object THEN
            -- El constraint ya existe, no hacer nada
            NULL;
    END;
END $$;

-- PASO 4: VERIFICAR PRODUCTOS EXISTENTES
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

-- PASO 5: INSERTAR REGLAS (solo si existen ambos productos)

-- Regla 1: Mazorca ↔ Plátano
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

-- Regla 2: Arroz → Aguacate
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

-- Regla 3: Arroz → Plátano
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

-- Regla 4: Arroz → Mazorca
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

-- Regla 5: Porción carne ↔ Porción pollo
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

-- Regla 6: Tocino → Porción carne
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

-- Regla 7: Aguacate → Mazorca
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

-- Regla 8: Aguacate → Plátano
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

-- PASO 7: CREAR FUNCIÓN
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

-- PASO 8: PERMISOS RLS (usar DO blocks para manejar errores)
ALTER TABLE product_substitution_rules ENABLE ROW LEVEL SECURITY;

-- Política de lectura
DO $$
BEGIN
    BEGIN
        CREATE POLICY "Users can read substitution rules" ON product_substitution_rules
            FOR SELECT
            TO authenticated
            USING (true);
    EXCEPTION
        WHEN duplicate_object THEN
            -- La política ya existe, no hacer nada
            NULL;
    END;
END $$;

-- Política de administración
DO $$
BEGIN
    BEGIN
        CREATE POLICY "Admins can manage substitution rules" ON product_substitution_rules
            FOR ALL
            TO authenticated
            USING (true);
    EXCEPTION
        WHEN duplicate_object THEN
            -- La política ya existe, no hacer nada
            NULL;
    END;
END $$;

-- PASO 9: MENSAJE FINAL
SELECT 'Script de sustituciones ejecutado exitosamente. Revisa el PASO 6 para ver las reglas creadas.' as resultado;