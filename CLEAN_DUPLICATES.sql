-- ===================================================================
-- LIMPIAR REGISTROS DUPLICADOS DE SUSTITUCIONES
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ===================================================================

-- Ver duplicados actuales
SELECT
  orden_id,
  original_name,
  substitute_name,
  parent_item_name,
  COUNT(*) as duplicates
FROM order_substitution_history
GROUP BY orden_id, original_name, substitute_name, parent_item_name
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

-- Eliminar duplicados manteniendo solo el registro más reciente
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY orden_id, original_name, substitute_name, parent_item_name
      ORDER BY applied_at DESC
    ) as rn
  FROM order_substitution_history
)
DELETE FROM order_substitution_history
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Verificar que se eliminaron los duplicados
SELECT
  orden_id,
  original_name,
  substitute_name,
  parent_item_name,
  COUNT(*) as count
FROM order_substitution_history
GROUP BY orden_id, original_name, substitute_name, parent_item_name
HAVING COUNT(*) > 1;