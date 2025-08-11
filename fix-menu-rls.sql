-- Script para solucionar problemas de acceso a las tablas del menú
-- Ejecutar este script en el SQL Editor de Supabase

-- Deshabilitar RLS temporalmente para las tablas del menú
ALTER TABLE platos DISABLE ROW LEVEL SECURITY;
ALTER TABLE toppings DISABLE ROW LEVEL SECURITY;
ALTER TABLE bebidas DISABLE ROW LEVEL SECURITY;
ALTER TABLE plato_toppings DISABLE ROW LEVEL SECURITY;

-- Verificar que las tablas existen y tienen datos
SELECT 'platos' as table_name, COUNT(*) as count FROM platos
UNION ALL
SELECT 'toppings' as table_name, COUNT(*) as count FROM toppings
UNION ALL
SELECT 'bebidas' as table_name, COUNT(*) as count FROM bebidas
UNION ALL
SELECT 'plato_toppings' as table_name, COUNT(*) as count FROM plato_toppings;

-- Verificar datos específicos
SELECT 'platos disponibles' as info, COUNT(*) as count FROM platos WHERE available = true
UNION ALL
SELECT 'toppings disponibles' as info, COUNT(*) as count FROM toppings WHERE available = true
UNION ALL
SELECT 'bebidas disponibles' as info, COUNT(*) as count FROM bebidas WHERE available = true;

-- Mostrar algunos platos con sus toppings
SELECT 
    p.id as plato_id,
    p.name as plato_name,
    p.pricing as plato_precio,
    p.available as plato_disponible,
    COUNT(pt."topping_Id") as num_toppings
FROM platos p
LEFT JOIN plato_toppings pt ON pt.plato_id = p.id
GROUP BY p.id, p.name, p.pricing, p.available
ORDER BY p.name;

-- Nota: Después de que funcione el menú, puedes volver a habilitar RLS con:
-- ALTER TABLE platos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE toppings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bebidas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE plato_toppings ENABLE ROW LEVEL SECURITY; 