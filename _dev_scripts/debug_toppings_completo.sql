-- 🔍 DEBUG COMPLETO PARA TOPPINGS

-- 1. Verificar que la tabla toppings existe y tiene datos
SELECT 'TABLA TOPPINGS' as seccion;
SELECT COUNT(*) as total_toppings FROM toppings;
SELECT id, name, pricing, available FROM toppings ORDER BY id LIMIT 10;

-- 2. Verificar que la tabla ordenes_toppings existe
SELECT 'TABLA ORDENES_TOPPINGS' as seccion;
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'ordenes_toppings'
) as tabla_ordenes_toppings_existe;

-- 3. Si existe, mostrar estructura
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ordenes_toppings' 
ORDER BY ordinal_position;

-- 4. Contar registros en ordenes_toppings
SELECT COUNT(*) as total_registros_ordenes_toppings FROM ordenes_toppings;

-- 5. Mostrar algunos ejemplos si existen
SELECT * FROM ordenes_toppings LIMIT 5;

-- 6. Verificar ordenes específicas (las del dashboard)
SELECT 'VERIFICAR ORDENES 111 Y 108' as seccion;
SELECT id, status, created_at FROM ordenes WHERE id IN (111, 108);

-- 7. Verificar si estas ordenes tienen toppings
SELECT 
    ot.orden_id,
    ot.topping_id,
    t.name as topping_name,
    t.pricing
FROM ordenes_toppings ot
JOIN toppings t ON ot.topping_id = t.id
WHERE ot.orden_id IN (111, 108);

-- 8. Verificar el hook useMenu para entender por qué no carga
SELECT 'DEBUG MENU HOOK' as seccion;
SELECT sede_id FROM profiles LIMIT 1; -- Para ver que sede está activa