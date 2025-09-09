-- Script para verificar el estado actual de los constraints en minutas
-- Esto nos ayudará a confirmar el problema antes de corregirlo

-- 1. Verificar constraints actuales en la tabla minutas
SELECT 'CONSTRAINTS ACTUALES EN MINUTAS:' as info;

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type,
  kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'minutas'
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- 2. Verificar datos actuales en minutas
SELECT 'DATOS ACTUALES EN MINUTAS:' as info;

SELECT 
  m.id,
  m.order_id,
  m.sede_id,
  m.dia,
  m.daily_id,
  s.name as sede_nombre
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
ORDER BY m.dia DESC, m.sede_id, m.daily_id;

-- 3. Verificar contadores actuales
SELECT 'CONTADORES ACTUALES:' as info;

SELECT 
  fecha,
  sede_id,
  last_value,
  s.name as sede_nombre
FROM daily_minuta_counters_sede dmcs
LEFT JOIN sedes s ON dmcs.sede_id = s.id
ORDER BY fecha DESC, sede_id;

-- 4. Verificar si hay duplicados que causen problemas
SELECT 'VERIFICANDO DUPLICADOS:' as info;

-- Duplicados en el constraint actual (solo dia, daily_id)
SELECT 
  dia,
  daily_id,
  COUNT(*) as duplicados,
  STRING_AGG(sede_id::text, ', ') as sedes_afectadas
FROM minutas
GROUP BY dia, daily_id
HAVING COUNT(*) > 1;

-- 5. Mostrar el problema específico
SELECT 'PROBLEMA IDENTIFICADO:' as info;

SELECT 
  'El constraint actual solo incluye (dia, daily_id) pero debería incluir (dia, sede_id, daily_id)' as problema,
  'Esto causa conflictos cuando múltiples sedes intentan usar el mismo daily_id en el mismo día' as explicacion;

