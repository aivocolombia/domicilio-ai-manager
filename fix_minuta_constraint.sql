-- Script para corregir el constraint único en la tabla minutas
-- El problema es que el constraint actual no incluye sede_id, causando conflictos

-- 1. Verificar constraints actuales en la tabla minutas
SELECT 'Verificando constraints actuales...' as status;

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'minutas'
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- 2. Eliminar el constraint problemático (si existe)
SELECT 'Eliminando constraint problemático...' as status;

-- Eliminar constraint que solo incluye dia y daily_id
DROP CONSTRAINT IF EXISTS minutas_dia_daily_id_key;

-- 3. Crear el constraint correcto que incluye sede_id
SELECT 'Creando constraint correcto...' as status;

-- Crear constraint único que incluya sede_id
ALTER TABLE minutas 
ADD CONSTRAINT minutas_dia_sede_daily_key 
UNIQUE (dia, sede_id, daily_id);

-- 4. Verificar que el constraint se creó correctamente
SELECT 'Verificando nuevo constraint...' as status;

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'minutas'
  AND tc.constraint_name = 'minutas_dia_sede_daily_key'
ORDER BY kcu.ordinal_position;

-- 5. Verificar que no hay datos duplicados que causen problemas
SELECT 'Verificando datos duplicados...' as status;

-- Verificar duplicados en el constraint anterior
SELECT 
  dia,
  daily_id,
  COUNT(*) as duplicados
FROM minutas
GROUP BY dia, daily_id
HAVING COUNT(*) > 1;

-- Verificar duplicados en el nuevo constraint
SELECT 
  dia,
  sede_id,
  daily_id,
  COUNT(*) as duplicados
FROM minutas
GROUP BY dia, sede_id, daily_id
HAVING COUNT(*) > 1;

-- 6. Mostrar datos actuales para verificar
SELECT 'Datos actuales en minutas...' as status;

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
LIMIT 20;

-- 7. Verificar contadores actuales
SELECT 'Contadores actuales...' as status;

SELECT 
  fecha,
  sede_id,
  last_value,
  s.name as sede_nombre
FROM daily_minuta_counters_sede dmcs
LEFT JOIN sedes s ON dmcs.sede_id = s.id
ORDER BY fecha DESC, sede_id
LIMIT 20;

