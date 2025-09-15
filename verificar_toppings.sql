-- Script para verificar toppings en la base de datos

-- 1. Verificar que la tabla toppings existe y tiene datos
SELECT 'VERIFICACIÓN TABLA TOPPINGS' as verificacion;
SELECT COUNT(*) as total_toppings FROM toppings;
SELECT id, name, pricing, available FROM toppings ORDER BY id;

-- 2. Verificar que la tabla ordenes_toppings existe
SELECT 'VERIFICACIÓN TABLA ORDENES_TOPPINGS' as verificacion;
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'ordenes_toppings'
) as tabla_ordenes_toppings_existe;

-- 3. Si existe, mostrar estructura
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ordenes_toppings' 
ORDER BY ordinal_position;

-- 4. Verificar datos en ordenes_toppings (si existe)
-- SELECT COUNT(*) as total_ordenes_toppings FROM ordenes_toppings;

-- 5. Insertar toppings de ejemplo si no existen
INSERT INTO toppings (name, pricing, available) 
SELECT * FROM (VALUES
    ('Queso Extra', 2000, true),
    ('Aguacate', 3000, true),
    ('Tocino', 4000, true),
    ('Pollo Desmechado', 5000, true),
    ('Carne Desmechada', 5500, true)
) AS v(name, pricing, available)
WHERE NOT EXISTS (SELECT 1 FROM toppings WHERE name = v.name);

-- 6. Verificar toppings después de insertar
SELECT 'TOPPINGS DESPUÉS DE INSERTAR' as verificacion;
SELECT id, name, pricing, available FROM toppings ORDER BY id;