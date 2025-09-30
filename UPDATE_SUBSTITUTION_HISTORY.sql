-- ===================================================================
-- ACTUALIZAR TABLA SUSTITUTION HISTORY PARA MANEJAR ITEMS INDIVIDUALES
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ===================================================================

-- Agregar columna orden_item_id para referenciar items específicos
ALTER TABLE order_substitution_history
ADD COLUMN IF NOT EXISTS orden_item_id INTEGER;

-- Comentar la columna para documentar su propósito
COMMENT ON COLUMN order_substitution_history.orden_item_id
IS 'ID específico del item en ordenes_platos/ordenes_bebidas/ordenes_toppings para distinguir productos individuales';

-- Crear índice para mejorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_substitution_history_orden_item_id
ON order_substitution_history(orden_item_id);

-- Verificar estructura actualizada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'order_substitution_history'
ORDER BY ordinal_position;

-- Mostrar algunas filas de ejemplo para verificar
SELECT * FROM order_substitution_history LIMIT 5;