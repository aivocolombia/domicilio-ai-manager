-- Script para debuggear la Limonada natural
-- Este script verifica el estado de la bebida en todas las tablas relevantes

-- 1. Buscar la Limonada natural en la tabla bebidas
SELECT 
  'Bebida base' as info,
  id,
  name,
  pricing,
  created_at,
  updated_at
FROM bebidas 
WHERE name ILIKE '%limonada%' OR name ILIKE '%natural%'
ORDER BY name;

-- 2. Verificar si hay registros en sede_bebidas para la Limonada
SELECT 
  'Registros en sede_bebidas' as info,
  sb.sede_id,
  s.name as sede_nombre,
  sb.bebida_id,
  b.name as bebida_nombre,
  sb.available,
  sb.price_override,
  sb.updated_at
FROM sede_bebidas sb
JOIN bebidas b ON b.id = sb.bebida_id
JOIN sedes s ON s.id = sb.sede_id
WHERE b.name ILIKE '%limonada%' OR b.name ILIKE '%natural%'
ORDER BY s.name, b.name;

-- 3. Verificar todas las sedes activas
SELECT 
  'Sedes activas' as info,
  id,
  name,
  is_active
FROM sedes
WHERE is_active = true
ORDER BY name;

-- 4. Verificar si faltan registros de sede_bebidas para la Limonada
SELECT 
  'Faltan registros de sede_bebidas' as info,
  s.id as sede_id,
  s.name as sede_nombre,
  b.id as bebida_id,
  b.name as bebida_nombre
FROM sedes s
CROSS JOIN bebidas b
LEFT JOIN sede_bebidas sb ON s.id = sb.sede_id AND b.id = sb.bebida_id
WHERE s.is_active = true 
  AND (b.name ILIKE '%limonada%' OR b.name ILIKE '%natural%')
  AND sb.sede_id IS NULL
ORDER BY s.name, b.name;

-- 5. Crear registros faltantes para la Limonada (descomenta si es necesario)
/*
INSERT INTO sede_bebidas (sede_id, bebida_id, available, price_override, updated_at)
SELECT 
  s.id as sede_id,
  b.id as bebida_id,
  true as available, -- Por defecto disponible
  b.pricing as price_override, -- Usar precio base
  now() as updated_at
FROM sedes s
CROSS JOIN bebidas b
WHERE s.is_active = true 
  AND (b.name ILIKE '%limonada%' OR b.name ILIKE '%natural%')
ON CONFLICT (sede_id, bebida_id) DO UPDATE SET
  available = EXCLUDED.available,
  price_override = EXCLUDED.price_override,
  updated_at = EXCLUDED.updated_at;
*/

-- 6. Verificar el resultado después de la inserción
SELECT 
  'Estado final' as info,
  COUNT(*) as total_registros_limonada
FROM sede_bebidas sb
JOIN bebidas b ON b.id = sb.bebida_id
WHERE b.name ILIKE '%limonada%' OR b.name ILIKE '%natural%'; 