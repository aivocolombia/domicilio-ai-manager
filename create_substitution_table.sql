-- ===================================================================
-- MIGRATION: Crear tabla para historial de sustituciones de productos
-- ===================================================================

-- Crear tabla principal
CREATE TABLE IF NOT EXISTS order_substitution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('plato', 'bebida', 'topping')),
  item_id INTEGER NOT NULL,
  substitution_type TEXT NOT NULL CHECK (substitution_type IN ('product_substitution', 'topping_substitution')),
  original_name TEXT NOT NULL,
  substitute_name TEXT NOT NULL,
  price_difference DECIMAL(10,2) NOT NULL DEFAULT 0,
  parent_item_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_substitution_history_orden_id
  ON order_substitution_history(orden_id);

CREATE INDEX IF NOT EXISTS idx_substitution_history_created_at
  ON order_substitution_history(created_at);

CREATE INDEX IF NOT EXISTS idx_substitution_history_type
  ON order_substitution_history(substitution_type);

-- Habilitar Row Level Security
ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
DROP POLICY IF EXISTS "Users can view substitution history" ON order_substitution_history;
CREATE POLICY "Users can view substitution history" ON order_substitution_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert substitution history" ON order_substitution_history;
CREATE POLICY "Users can insert substitution history" ON order_substitution_history
  FOR INSERT WITH CHECK (true);

-- Agregar comentarios para documentación
COMMENT ON TABLE order_substitution_history IS
'Historial de sustituciones realizadas en órdenes. Registra cuando se cambia un producto por otro o cuando se cambian toppings.';

COMMENT ON COLUMN order_substitution_history.orden_id IS
'ID de la orden donde se realizó la sustitución';

COMMENT ON COLUMN order_substitution_history.item_type IS
'Tipo del item que se sustituyó: plato, bebida, o topping';

COMMENT ON COLUMN order_substitution_history.item_id IS
'ID del item que se sustituyó en las tablas correspondientes';

COMMENT ON COLUMN order_substitution_history.substitution_type IS
'Tipo de sustitución: product_substitution (cambio completo de producto) o topping_substitution (cambio de topping)';

COMMENT ON COLUMN order_substitution_history.original_name IS
'Nombre original del producto antes de la sustitución';

COMMENT ON COLUMN order_substitution_history.substitute_name IS
'Nombre del producto después de la sustitución';

COMMENT ON COLUMN order_substitution_history.price_difference IS
'Diferencia de precio causada por la sustitución (+ = más caro, - = más barato)';

COMMENT ON COLUMN order_substitution_history.parent_item_name IS
'Para toppings, nombre del plato que contenía el topping sustituido';

-- Verificar que la tabla se creó correctamente
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'order_substitution_history'
ORDER BY ordinal_position;