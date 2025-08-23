-- Script para poblar las tablas de sede con datos iniciales
-- Este script asume que ya existen datos en las tablas platos, bebidas, toppings y sedes

-- 1. Poblar sede_platos con todos los platos disponibles para todas las sedes
INSERT INTO sede_platos (sede_id, plato_id, available, price_override, updated_at)
SELECT 
  s.id as sede_id,
  p.id as plato_id,
  true as available, -- Por defecto disponibles
  p.pricing as price_override, -- Usar el precio base del plato
  now() as updated_at
FROM sedes s
CROSS JOIN platos p
WHERE s.is_active = true
ON CONFLICT (sede_id, plato_id) DO UPDATE SET
  available = EXCLUDED.available,
  price_override = EXCLUDED.price_override,
  updated_at = EXCLUDED.updated_at;

-- 2. Poblar sede_bebidas con todas las bebidas disponibles para todas las sedes
INSERT INTO sede_bebidas (sede_id, bebida_id, available, price_override, updated_at)
SELECT 
  s.id as sede_id,
  b.id as bebida_id,
  true as available, -- Por defecto disponibles
  b.pricing as price_override, -- Usar el precio base de la bebida
  now() as updated_at
FROM sedes s
CROSS JOIN bebidas b
WHERE s.is_active = true
ON CONFLICT (sede_id, bebida_id) DO UPDATE SET
  available = EXCLUDED.available,
  price_override = EXCLUDED.price_override,
  updated_at = EXCLUDED.updated_at;

-- 3. Poblar sede_toppings con todos los toppings disponibles para todas las sedes
INSERT INTO sede_toppings (sede_id, topping_id, available, price_override, updated_at)
SELECT 
  s.id as sede_id,
  t.id as topping_id,
  true as available, -- Por defecto disponibles
  t.pricing as price_override, -- Usar el precio base del topping
  now() as updated_at
FROM sedes s
CROSS JOIN toppings t
WHERE s.is_active = true
ON CONFLICT (sede_id, topping_id) DO UPDATE SET
  available = EXCLUDED.available,
  price_override = EXCLUDED.price_override,
  updated_at = EXCLUDED.updated_at;

-- 4. Verificar que los datos se insertaron correctamente
SELECT 
  'sede_platos' as tabla,
  COUNT(*) as total_registros
FROM sede_platos
UNION ALL
SELECT 
  'sede_bebidas' as tabla,
  COUNT(*) as total_registros
FROM sede_bebidas
UNION ALL
SELECT 
  'sede_toppings' as tabla,
  COUNT(*) as total_registros
FROM sede_toppings;

-- 5. Mostrar algunos ejemplos de datos insertados
SELECT 
  'Ejemplos de sede_platos:' as info,
  sede_id,
  plato_id,
  available,
  price_override
FROM sede_platos
LIMIT 5; 