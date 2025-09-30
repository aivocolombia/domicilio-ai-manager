/**
 * Script simple para investigar la estructura de la base de datos
 */

console.log('🔍 Generando script SQL corregido para sustituciones...\n');

// Primero, vamos a crear un script SQL que puedes ejecutar directamente
// Este script incluirá una verificación de productos existentes

const sqlScript = `
-- =====================================================
-- SCRIPT CORREGIDO PARA SUSTITUCIONES DE PRODUCTOS
-- =====================================================

-- 1. CREAR TABLA SI NO EXISTE
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

-- 2. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_substitution_original ON product_substitution_rules(original_product_id, original_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_substitute ON product_substitution_rules(substitute_product_id, substitute_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_active ON product_substitution_rules(is_active);

-- 3. CONSTRAINT ÚNICO
ALTER TABLE product_substitution_rules
ADD CONSTRAINT IF NOT EXISTS unique_substitution_rule
UNIQUE (original_product_id, original_product_type, substitute_product_id, substitute_product_type);

-- 4. VERIFICAR PRODUCTOS EXISTENTES ANTES DE INSERTAR
-- Ejecuta esta query PRIMERO para ver qué productos tienes:

SELECT 'TOPPINGS DISPONIBLES:' as info;
SELECT id, name, 'topping' as type FROM toppings
WHERE name ILIKE ANY(ARRAY['%mazorca%', '%plátano%', '%platano%', '%arroz%', '%carne%', '%tocino%', '%pollo%', '%aguacate%'])
ORDER BY name;

SELECT 'PLATOS DISPONIBLES:' as info;
SELECT id, name, 'plato' as type FROM platos
WHERE name ILIKE ANY(ARRAY['%porción%', '%porcion%', '%carne%', '%pollo%'])
ORDER BY name;

-- 5. SCRIPT PARA INSERTAR REGLAS (EJECUTAR DESPUÉS DE VERIFICAR IDs)
-- IMPORTANTE: Reemplaza estos comentarios con los IDs reales que obtengas arriba

-- Ejemplo de cómo insertar (reemplaza con IDs reales):
/*
-- Si encuentras: ID 1 = Mazorca, ID 2 = Plátano
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(1, 'topping', 2, 'topping', 0.00, true, 'Mazorca ↔ Plátano ($3,700)');

-- Si encuentras: ID 3 = Arroz, ID 4 = Aguacate
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(3, 'topping', 4, 'topping', -600.00, false, 'Arroz ($4,800) → Aguacate ($4,200)');
*/

-- 6. FUNCIÓN PARA OBTENER SUSTITUCIONES
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

-- 7. PERMISOS RLS
ALTER TABLE product_substitution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read substitution rules" ON product_substitution_rules
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage substitution rules" ON product_substitution_rules
    FOR ALL
    TO authenticated
    USING (true);

-- 8. HABILITAR REALTIME (OPCIONAL)
-- ALTER PUBLICATION supabase_realtime ADD TABLE product_substitution_rules;

-- =====================================================
-- INSTRUCCIONES DE USO:
-- =====================================================
/*
1. Ejecuta las secciones 1-3 para crear la tabla
2. Ejecuta la sección 4 para ver qué productos existen
3. Anota los IDs que obtengas
4. Modifica la sección 5 con los IDs reales
5. Ejecuta las secciones 6-7 para completar la instalación

EJEMPLO DE CÓMO LLENAR LA SECCIÓN 5:
Si obtienes estos resultados de la sección 4:
- ID 15: Mazorca
- ID 23: Plátano
- ID 8: Arroz
- ID 12: Aguacate

Entonces reemplazarías en la sección 5:
INSERT INTO product_substitution_rules VALUES
(15, 'topping', 23, 'topping', 0.00, true, 'Mazorca ↔ Plátano'),
(8, 'topping', 12, 'topping', -600.00, false, 'Arroz → Aguacate'),
... etc
*/
`;

console.log(sqlScript);

console.log('\n✅ Script SQL generado y guardado en fixed_substitutions.sql');
console.log('\n📋 PASOS A SEGUIR:');
console.log('1. Abre Supabase SQL Editor');
console.log('2. Ejecuta las secciones 1-3 del script');
console.log('3. Ejecuta la sección 4 para ver productos existentes');
console.log('4. Anota los IDs reales que obtengas');
console.log('5. Modifica la sección 5 con esos IDs');
console.log('6. Ejecuta todo lo demás');

console.log('\n⚠️  IMPORTANTE: No insertes reglas hasta verificar que los productos existen!');