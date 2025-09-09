-- Script para verificar que el trigger de minutas funcione correctamente
-- con la nueva lógica de consecutivos por sede

-- 1. Verificar que las tablas existen
SELECT 'Verificando tablas...' as status;

-- Verificar tabla minutas
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'minutas' 
ORDER BY ordinal_position;

-- Verificar tabla daily_minuta_counters_sede
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'daily_minuta_counters_sede' 
ORDER BY ordinal_position;

-- 2. Verificar que el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trg_minuta_after_order';

-- 3. Verificar que la función existe
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'create_minuta_on_order_sede';

-- 4. Verificar que la función de contador existe
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'next_minuta_no_sede';

-- 5. Probar la función de contador manualmente
SELECT 'Probando función next_minuta_no_sede...' as status;

-- Obtener una sede de prueba
SELECT id as sede_id FROM sedes LIMIT 1;

-- Probar la función (reemplaza 'SEDE_ID_AQUI' con un UUID real de sedes)
-- SELECT next_minuta_no_sede(CURRENT_DATE, 'SEDE_ID_AQUI');

-- 6. Verificar datos existentes
SELECT 'Verificando datos existentes...' as status;

-- Ver minutas existentes
SELECT 
  m.id,
  m.order_id,
  m.sede_id,
  m.dia,
  m.daily_id,
  s.name as sede_nombre
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
ORDER BY m.dia DESC, m.sede_id, m.daily_id
LIMIT 10;

-- Ver contadores por sede
SELECT 
  fecha,
  sede_id,
  last_value,
  s.name as sede_nombre
FROM daily_minuta_counters_sede dmcs
LEFT JOIN sedes s ON dmcs.sede_id = s.id
ORDER BY fecha DESC, sede_id
LIMIT 10;

-- 7. Verificar integridad de datos
SELECT 'Verificando integridad...' as status;

-- Verificar que no hay minutas duplicadas por sede y día
SELECT 
  sede_id,
  dia,
  daily_id,
  COUNT(*) as duplicados
FROM minutas
GROUP BY sede_id, dia, daily_id
HAVING COUNT(*) > 1;

-- Verificar que todas las minutas tienen sede_id
SELECT COUNT(*) as minutas_sin_sede
FROM minutas
WHERE sede_id IS NULL;

-- Verificar que todas las minutas tienen daily_id
SELECT COUNT(*) as minutas_sin_daily_id
FROM minutas
WHERE daily_id IS NULL;
