-- Script para verificar y crear registros en sede_toppings
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si la tabla existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'sede_toppings'
) as table_exists;

-- 2. Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sede_toppings'
ORDER BY ordinal_position;

-- 3. Verificar registros existentes
SELECT 
  st.sede_id,
  s.name as sede_name,
  st.topping_id,
  t.name as topping_name,
  st.available,
  st.price_override,
  st.updated_at
FROM sede_toppings st
JOIN sedes s ON s.id = st.sede_id
JOIN toppings t ON t.id = st.topping_id
ORDER BY s.name, t.name;

-- 4. Verificar toppings que no tienen registros en sede_toppings
SELECT 
  t.id as topping_id,
  t.name as topping_name,
  s.id as sede_id,
  s.name as sede_name
FROM toppings t
CROSS JOIN sedes s
WHERE s.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM sede_toppings st 
  WHERE st.topping_id = t.id 
  AND st.sede_id = s.id
)
ORDER BY s.name, t.name;

-- 5. Crear registros faltantes (descomenta si es necesario)
/*
INSERT INTO sede_toppings (sede_id, topping_id, available, price_override, updated_at)
SELECT 
  s.id as sede_id,
  t.id as topping_id,
  true as available, -- Por defecto disponibles
  t.pricing as price_override, -- Usar precio base del topping
  now() as updated_at
FROM toppings t
CROSS JOIN sedes s
WHERE s.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM sede_toppings st 
  WHERE st.topping_id = t.id 
  AND st.sede_id = s.id
)
ON CONFLICT (sede_id, topping_id) DO UPDATE SET
  available = EXCLUDED.available,
  price_override = EXCLUDED.price_override,
  updated_at = EXCLUDED.updated_at;
*/

-- 6. Verificar total de registros
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT sede_id) as sedes_con_toppings,
  COUNT(DISTINCT topping_id) as toppings_con_sedes
FROM sede_toppings; 