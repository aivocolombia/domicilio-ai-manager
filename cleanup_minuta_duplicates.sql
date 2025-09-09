-- Script para limpiar datos duplicados en minutas si es necesario
-- Solo ejecutar si hay duplicados después de corregir el constraint

-- 1. Verificar duplicados antes de limpiar
SELECT 'Verificando duplicados antes de limpiar...' as status;

SELECT 
  dia,
  daily_id,
  COUNT(*) as duplicados,
  STRING_AGG(sede_id::text, ', ') as sedes_afectadas
FROM minutas
GROUP BY dia, daily_id
HAVING COUNT(*) > 1;

-- 2. Mostrar detalles de los duplicados
SELECT 'Detalles de duplicados...' as status;

SELECT 
  m.id,
  m.order_id,
  m.sede_id,
  m.dia,
  m.daily_id,
  s.name as sede_nombre,
  o.created_at as orden_created_at
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
LEFT JOIN ordenes o ON m.order_id = o.id
WHERE (m.dia, m.daily_id) IN (
  SELECT dia, daily_id
  FROM minutas
  GROUP BY dia, daily_id
  HAVING COUNT(*) > 1
)
ORDER BY m.dia, m.daily_id, m.sede_id;

-- 3. Limpiar duplicados (mantener solo el más reciente por sede)
-- IMPORTANTE: Solo ejecutar si hay duplicados y después de hacer backup

/*
-- Crear tabla temporal con los IDs a mantener
CREATE TEMP TABLE minutas_to_keep AS
SELECT DISTINCT ON (dia, sede_id, daily_id)
  id
FROM minutas
ORDER BY dia, sede_id, daily_id, created_at DESC;

-- Eliminar duplicados (mantener solo los más recientes)
DELETE FROM minutas
WHERE id NOT IN (SELECT id FROM minutas_to_keep);

-- Verificar que se eliminaron los duplicados
SELECT 'Verificando después de limpiar...' as status;

SELECT 
  dia,
  daily_id,
  COUNT(*) as duplicados
FROM minutas
GROUP BY dia, daily_id
HAVING COUNT(*) > 1;
*/

-- 4. Alternativa: Reasignar daily_id para evitar conflictos
-- Si hay duplicados, podemos reasignar los daily_id para que sean únicos por sede

/*
-- Obtener el siguiente daily_id disponible para cada sede
WITH next_daily_ids AS (
  SELECT 
    sede_id,
    dia,
    COALESCE(MAX(daily_id), 0) + 1 as next_daily_id
  FROM minutas
  GROUP BY sede_id, dia
)
UPDATE minutas
SET daily_id = next_daily_ids.next_daily_id + ROW_NUMBER() OVER (PARTITION BY sede_id, dia ORDER BY created_at)
FROM next_daily_ids
WHERE minutas.sede_id = next_daily_ids.sede_id
  AND minutas.dia = next_daily_ids.dia
  AND minutas.daily_id IN (
    SELECT daily_id
    FROM minutas m2
    WHERE m2.dia = minutas.dia
      AND m2.daily_id = minutas.daily_id
      AND m2.sede_id != minutas.sede_id
  );
*/

-- 5. Verificar estado final
SELECT 'Estado final después de limpiar...' as status;

SELECT 
  sede_id,
  s.name as sede_nombre,
  dia,
  COUNT(*) as total_minutas,
  MIN(daily_id) as min_daily_id,
  MAX(daily_id) as max_daily_id
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
GROUP BY sede_id, s.name, dia
ORDER BY dia DESC, sede_id;

