-- =====================================================
-- SCRIPT PARA SISTEMA DE SUSTITUCIONES DE PRODUCTOS
-- =====================================================
-- Este script crea las tablas y datos necesarios para el sistema
-- de sustituciones automáticas de productos en las órdenes

-- =====================================================
-- 1. CREAR TABLA DE REGLAS DE SUSTITUCIÓN
-- =====================================================

-- Tabla principal que define qué productos se pueden sustituir por otros
CREATE TABLE IF NOT EXISTS product_substitution_rules (
    id SERIAL PRIMARY KEY,
    original_product_id INTEGER NOT NULL,
    original_product_type VARCHAR(20) NOT NULL CHECK (original_product_type IN ('plato', 'bebida', 'topping')),
    substitute_product_id INTEGER NOT NULL,
    substitute_product_type VARCHAR(20) NOT NULL CHECK (substitute_product_type IN ('plato', 'bebida', 'topping')),
    price_difference DECIMAL(10,2) DEFAULT 0.00,
    is_bidirectional BOOLEAN DEFAULT false, -- Si true, la sustitución funciona en ambas direcciones
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_substitution_original ON product_substitution_rules(original_product_id, original_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_substitute ON product_substitution_rules(substitute_product_id, substitute_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_active ON product_substitution_rules(is_active);

-- =====================================================
-- 2. CONSTRAINT PARA EVITAR DUPLICADOS
-- =====================================================

-- Evitar reglas duplicadas (mismo original y sustituto)
ALTER TABLE product_substitution_rules
ADD CONSTRAINT unique_substitution_rule
UNIQUE (original_product_id, original_product_type, substitute_product_id, substitute_product_type);

-- =====================================================
-- 3. FUNCIÓN PARA ACTUALIZAR TIMESTAMP
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_substitution_rules_updated_at ON product_substitution_rules;
CREATE TRIGGER update_substitution_rules_updated_at
    BEFORE UPDATE ON product_substitution_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. OBTENER IDs DE PRODUCTOS ACTUALES
-- =====================================================

-- Query para verificar productos existentes (ejecutar primero para obtener IDs)
-- IMPORTANTE: Ejecuta estas queries ANTES de insertar las reglas para obtener los IDs correctos

/*
-- Toppings disponibles
SELECT id, name, 'topping' as type FROM toppings WHERE name ILIKE ANY(ARRAY['%mazorca%', '%plátano%', '%platano%', '%arroz%', '%carne%', '%tocino%', '%pollo%', '%aguacate%']) ORDER BY name;

-- Platos disponibles
SELECT id, name, 'plato' as type FROM platos WHERE name ILIKE ANY(ARRAY['%porción%', '%porcion%', '%carne%', '%pollo%']) ORDER BY name;

-- Bebidas disponibles (si aplica)
SELECT id, name, 'bebida' as type FROM bebidas ORDER BY name;
*/

-- =====================================================
-- 5. INSERTAR REGLAS DE SUSTITUCIÓN
-- =====================================================

-- IMPORTANTE: Reemplaza los IDs con los valores reales de tu base de datos
-- Ejecuta las queries de arriba primero para obtener los IDs correctos

-- Regla 1: Mazorca ↔ Plátano ($3,700 ambos)
-- Buscar ID de Mazorca y Plátano en toppings
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
-- Mazorca → Plátano
(
    (SELECT id FROM toppings WHERE name ILIKE '%mazorca%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%plátano%' OR name ILIKE '%platano%' LIMIT 1),
    'topping',
    0.00, -- Mismo precio
    true,  -- Bidireccional
    'Mazorca y Plátano son intercambiables - mismo precio $3,700'
);

-- Regla 2: Arroz → Aguacate/Plátano/Mazorca ($4,800 → varios precios)
-- Arroz → Aguacate
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(
    (SELECT id FROM toppings WHERE name ILIKE '%arroz%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%aguacate%' LIMIT 1),
    'topping',
    -600.00, -- $4,800 - $4,200 = $600 menos
    false,
    'Arroz ($4,800) → Aguacate ($4,200)'
);

-- Arroz → Plátano
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(
    (SELECT id FROM toppings WHERE name ILIKE '%arroz%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%plátano%' OR name ILIKE '%platano%' LIMIT 1),
    'topping',
    -1100.00, -- $4,800 - $3,700 = $1,100 menos
    false,
    'Arroz ($4,800) → Plátano ($3,700)'
);

-- Arroz → Mazorca
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(
    (SELECT id FROM toppings WHERE name ILIKE '%arroz%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%mazorca%' LIMIT 1),
    'topping',
    -1100.00, -- $4,800 - $3,700 = $1,100 menos
    false,
    'Arroz ($4,800) → Mazorca ($3,700)'
);

-- Regla 3: Porción carne ↔ Porción pollo ($6,300 ambos)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(
    (SELECT id FROM toppings WHERE name ILIKE '%porción%' AND name ILIKE '%carne%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%porción%' AND name ILIKE '%pollo%' LIMIT 1),
    'topping',
    0.00, -- Mismo precio
    true,  -- Bidireccional
    'Porción carne y Porción pollo son intercambiables - mismo precio $6,300'
);

-- Regla 4: Tocino → Porción de carne ($8,400 → $6,300)
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(
    (SELECT id FROM toppings WHERE name ILIKE '%tocino%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%porción%' AND name ILIKE '%carne%' LIMIT 1),
    'topping',
    -2100.00, -- $8,400 - $6,300 = $2,100 menos
    false,
    'Tocino ($8,400) → Porción carne ($6,300)'
);

-- Regla 5: Aguacate → Mazorca/Plátano ($4,200 → $3,700)
-- Aguacate → Mazorca
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(
    (SELECT id FROM toppings WHERE name ILIKE '%aguacate%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%mazorca%' LIMIT 1),
    'topping',
    -500.00, -- $4,200 - $3,700 = $500 menos
    false,
    'Aguacate ($4,200) → Mazorca ($3,700)'
);

-- Aguacate → Plátano
INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(
    (SELECT id FROM toppings WHERE name ILIKE '%aguacate%' LIMIT 1),
    'topping',
    (SELECT id FROM toppings WHERE name ILIKE '%plátano%' OR name ILIKE '%platano%' LIMIT 1),
    'topping',
    -500.00, -- $4,200 - $3,700 = $500 menos
    false,
    'Aguacate ($4,200) → Plátano ($3,700)'
);

-- =====================================================
-- 6. HABILITAR RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en la tabla
ALTER TABLE product_substitution_rules ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "Users can read substitution rules" ON product_substitution_rules
    FOR SELECT
    TO authenticated
    USING (true);

-- Política para permitir a admins gestionar las reglas
CREATE POLICY "Admins can manage substitution rules" ON product_substitution_rules
    FOR ALL
    TO authenticated
    USING (true); -- Aquí podrías agregar lógica más específica según roles

-- =====================================================
-- 7. HABILITAR REALTIME (OPCIONAL)
-- =====================================================

-- Si quieres que los cambios en reglas se reflejen en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE product_substitution_rules;

-- =====================================================
-- 8. QUERIES DE VERIFICACIÓN
-- =====================================================

-- Verificar que las reglas se insertaron correctamente
SELECT
    psr.id,
    psr.original_product_type,
    CASE
        WHEN psr.original_product_type = 'topping' THEN t1.name
        WHEN psr.original_product_type = 'plato' THEN p1.name
        WHEN psr.original_product_type = 'bebida' THEN b1.name
    END as original_product_name,
    '→' as arrow,
    CASE
        WHEN psr.substitute_product_type = 'topping' THEN t2.name
        WHEN psr.substitute_product_type = 'plato' THEN p2.name
        WHEN psr.substitute_product_type = 'bebida' THEN b2.name
    END as substitute_product_name,
    psr.price_difference,
    psr.is_bidirectional,
    psr.notes
FROM product_substitution_rules psr
LEFT JOIN toppings t1 ON psr.original_product_id = t1.id AND psr.original_product_type = 'topping'
LEFT JOIN platos p1 ON psr.original_product_id = p1.id AND psr.original_product_type = 'plato'
LEFT JOIN bebidas b1 ON psr.original_product_id = b1.id AND psr.original_product_type = 'bebida'
LEFT JOIN toppings t2 ON psr.substitute_product_id = t2.id AND psr.substitute_product_type = 'topping'
LEFT JOIN platos p2 ON psr.substitute_product_id = p2.id AND psr.substitute_product_type = 'plato'
LEFT JOIN bebidas b2 ON psr.substitute_product_id = b2.id AND psr.substitute_product_type = 'bebida'
WHERE psr.is_active = true
ORDER BY psr.id;

-- Query para obtener sustituciones disponibles para un producto específico
-- (Usar en la aplicación)
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

    -- Si la regla es bidireccional, también incluir el camino inverso
    SELECT
        psr.original_product_id as substitute_id,
        psr.original_product_type as substitute_type,
        CASE
            WHEN psr.original_product_type = 'topping' THEN t.name
            WHEN psr.original_product_type = 'plato' THEN p.name
            WHEN psr.original_product_type = 'bebida' THEN b.name
        END as substitute_name,
        -psr.price_difference as price_difference, -- Invertir diferencia de precio
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

-- =====================================================
-- 9. QUERY DE EJEMPLO PARA PROBAR LA FUNCIÓN
-- =====================================================

-- Ejemplo: obtener sustituciones para Mazorca (reemplazar ID por el real)
-- SELECT * FROM get_available_substitutions(
--     (SELECT id FROM toppings WHERE name ILIKE '%mazorca%' LIMIT 1),
--     'topping'
-- );

-- =====================================================
-- 10. COMENTARIOS FINALES
-- =====================================================

/*
INSTRUCCIONES DE EJECUCIÓN:

1. Ejecuta las queries de verificación (sección 4) PRIMERO para obtener los IDs reales
2. Reemplaza los IDs en las reglas de inserción (sección 5) con los valores reales
3. Ejecuta todo el script paso a paso
4. Verifica con la query de la sección 8 que todo se insertó correctamente
5. Prueba la función get_available_substitutions con IDs reales

PRÓXIMOS PASOS PARA LA APLICACIÓN:
- Crear servicio para consultar reglas de sustitución
- Modificar EditOrderModal para mostrar opciones de sustitución
- Implementar lógica para aplicar cambios de precio automáticamente
- Agregar UI/UX para seleccionar sustituciones
*/