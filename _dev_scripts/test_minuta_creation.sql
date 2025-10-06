-- Script para probar la creación de minutas con la nueva lógica
-- Este script simula la creación de órdenes para verificar que el trigger funcione

-- 1. Obtener datos de prueba
SELECT 'Obteniendo datos de prueba...' as status;

-- Obtener una sede
SELECT id as sede_id, name as sede_nombre FROM sedes LIMIT 1;

-- Obtener un cliente
SELECT id as cliente_id, nombre FROM clientes LIMIT 1;

-- Obtener un pago
SELECT id as pago_id FROM pagos LIMIT 1;

-- 2. Verificar estado antes de crear orden
SELECT 'Estado antes de crear orden...' as status;

-- Ver contadores actuales
SELECT 
  fecha,
  sede_id,
  last_value,
  s.name as sede_nombre
FROM daily_minuta_counters_sede dmcs
LEFT JOIN sedes s ON dmcs.sede_id = s.id
WHERE fecha = CURRENT_DATE;

-- Ver minutas del día actual
SELECT 
  m.id,
  m.order_id,
  m.sede_id,
  m.dia,
  m.daily_id,
  s.name as sede_nombre
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
WHERE m.dia = CURRENT_DATE
ORDER BY m.sede_id, m.daily_id;

-- 3. Crear una orden de prueba (reemplaza los IDs con valores reales)
-- IMPORTANTE: Reemplaza 'SEDE_ID_AQUI', 'CLIENTE_ID_AQUI', 'PAGO_ID_AQUI' con IDs reales

/*
INSERT INTO ordenes (
  cliente_id,
  payment_id,
  status,
  sede_id,
  observaciones,
  hora_entrega,
  precio_envio,
  created_at
) VALUES (
  CLIENTE_ID_AQUI,  -- Reemplazar con ID real
  PAGO_ID_AQUI,     -- Reemplazar con ID real
  'Recibidos',
  'SEDE_ID_AQUI',   -- Reemplazar con UUID real
  'Orden de prueba para minuta',
  NOW() + INTERVAL '90 minutes',
  6000,
  NOW()
) RETURNING id;
*/

-- 4. Verificar que se creó la minuta automáticamente
-- (Ejecutar después de crear la orden)

/*
SELECT 'Verificando minuta creada...' as status;

-- Ver la minuta recién creada
SELECT 
  m.id,
  m.order_id,
  m.sede_id,
  m.dia,
  m.daily_id,
  s.name as sede_nombre,
  o.status as orden_status
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
LEFT JOIN ordenes o ON m.order_id = o.id
WHERE m.dia = CURRENT_DATE
ORDER BY m.sede_id, m.daily_id DESC
LIMIT 5;

-- Ver contadores actualizados
SELECT 
  fecha,
  sede_id,
  last_value,
  s.name as sede_nombre
FROM daily_minuta_counters_sede dmcs
LEFT JOIN sedes s ON dmcs.sede_id = s.id
WHERE fecha = CURRENT_DATE;
*/

-- 5. Probar con múltiples sedes
-- Crear órdenes en diferentes sedes para verificar que los consecutivos son independientes

-- 6. Verificar que no hay duplicados
SELECT 'Verificando integridad...' as status;

SELECT 
  sede_id,
  dia,
  daily_id,
  COUNT(*) as duplicados
FROM minutas
WHERE dia = CURRENT_DATE
GROUP BY sede_id, dia, daily_id
HAVING COUNT(*) > 1;

-- 7. Verificar que el consecutivo es secuencial por sede
SELECT 
  sede_id,
  s.name as sede_nombre,
  daily_id,
  COUNT(*) as cantidad
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
WHERE m.dia = CURRENT_DATE
GROUP BY sede_id, s.name, daily_id
ORDER BY sede_id, daily_id;
