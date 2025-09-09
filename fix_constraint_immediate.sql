-- CORRECCI�N INMEDIATA DEL CONSTRAINT EN MINUTAS
-- Este script corrige el problema del constraint �nico que no incluye sede_id

-- PASO 1: Eliminar el constraint problem�tico
-- El constraint actual solo incluye (dia, daily_id) pero deber�a incluir (dia, sede_id, daily_id)

DROP CONSTRAINT IF EXISTS minutas_dia_daily_id_key;

-- PASO 2: Crear el constraint correcto que incluye sede_id
-- Ahora cada sede puede tener su propio consecutivo diario

ALTER TABLE minutas 
ADD CONSTRAINT minutas_dia_sede_daily_key 
UNIQUE (dia, sede_id, daily_id);

-- PASO 3: Verificar que el constraint se cre� correctamente
SELECT 'CONSTRAINT CORREGIDO - VERIFICACI�N:' as status;

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

-- PASO 4: Verificar que no hay duplicados
SELECT 'VERIFICANDO QUE NO HAY DUPLICADOS:' as status;

SELECT 
  sede_id,
  dia,
  daily_id,
  COUNT(*) as duplicados
FROM minutas
GROUP BY sede_id, dia, daily_id
HAVING COUNT(*) > 1;

-- Si no hay duplicados, el resultado estar� vac�o (correcto)
-- Si hay duplicados, necesitar�s ejecutar el script de limpieza

SELECT 'CORRECCI�N COMPLETADA' as status;

