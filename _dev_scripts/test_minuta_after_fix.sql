-- Script para probar la creación de minutas después de corregir el constraint
-- Este script simula la creación de una orden para verificar que el trigger funciona

-- 1. Obtener datos de prueba
SELECT 'Obteniendo datos de prueba...' as status;

-- Obtener una sede
SELECT id as sede_id, name as sede_nombre FROM sedes LIMIT 1;

-- Obtener un cliente
SELECT id as cliente_id, nombre, telefono FROM clientes LIMIT 1;

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

-- 3. Probar la función next_minuta_no_sede manualmente
SELECT 'Probando función next_minuta_no_sede...' as status;

-- Obtener una sede de prueba
SELECT id as sede_id, name as sede_nombre FROM sedes LIMIT 1;

-- Probar la función (reemplaza 'SEDE_ID_AQUI' con un UUID real)
-- SELECT next_minuta_no_sede(CURRENT_DATE, 'SEDE_ID_AQUI');

-- 4. Crear una orden de prueba
-- IMPORTANTE: Reemplaza los IDs con valores reales de las consultas anteriores

/*
-- Paso 1: Crear pago
INSERT INTO pagos (type, status, total_pago, created_at)
VALUES ('efectivo', 'pending', 25000, NOW())
RETURNING id as pago_id;

-- Paso 2: Crear orden (esto debería activar el trigger)
INSERT INTO ordenes (
  cliente_id,
  payment_id,
  status,
  sede_id,
  observaciones,
  hora_entrega,
  created_at
) VALUES (
  CLIENTE_ID_AQUI,  -- Reemplazar con ID real
  PAGO_ID_AQUI,     -- Reemplazar con ID real del paso anterior
  'Recibidos',
  'SEDE_ID_AQUI',   -- Reemplazar con UUID real
  'Orden de prueba después de corregir constraint',
  NOW() + INTERVAL '90 minutes',
  NOW()
) RETURNING id as orden_id;
*/

-- 5. Verificar que se creó la minuta automáticamente
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
WHERE m.order_id = ORDEN_ID_AQUI;  -- Reemplazar con ID real

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

-- 6. Verificar que no hay conflictos
SELECT 'Verificando que no hay conflictos...' as status;

-- Verificar que no hay duplicados en el nuevo constraint
SELECT 
  sede_id,
  dia,
  daily_id,
  COUNT(*) as duplicados
FROM minutas
WHERE dia = CURRENT_DATE
GROUP BY sede_id, dia, daily_id
HAVING COUNT(*) > 1;

-- Verificar que el consecutivo es secuencial por sede
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

-- 7. Verificar que el constraint funciona correctamente
SELECT 'Verificando constraint...' as status;

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'minutas'
  AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.constraint_name, kcu.ordinal_position;

