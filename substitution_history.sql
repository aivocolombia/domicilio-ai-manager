-- Crear tabla para almacenar historial de sustituciones
CREATE TABLE IF NOT EXISTS order_substitution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('plato', 'bebida', 'topping')),
  item_id INTEGER NOT NULL,
  substitution_type TEXT NOT NULL CHECK (substitution_type IN ('product_substitution', 'topping_substitution')),
  original_name TEXT NOT NULL,
  substitute_name TEXT NOT NULL,
  price_difference DECIMAL(10,2) NOT NULL DEFAULT 0,
  parent_item_name TEXT, -- Para toppings, nombre del plato padre
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_substitution_history_orden_id ON order_substitution_history(orden_id);
CREATE INDEX IF NOT EXISTS idx_substitution_history_created_at ON order_substitution_history(created_at);

-- RLS (Row Level Security) - permitir solo lectura y escritura para usuarios autenticados
ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view substitution history" ON order_substitution_history
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert substitution history" ON order_substitution_history
  FOR INSERT WITH CHECK (true);

-- Comentarios para documentación
COMMENT ON TABLE order_substitution_history IS 'Historial de sustituciones realizadas en órdenes';
COMMENT ON COLUMN order_substitution_history.orden_id IS 'ID de la orden donde se realizó la sustitución';
COMMENT ON COLUMN order_substitution_history.item_type IS 'Tipo del item sustituido (plato, bebida, topping)';
COMMENT ON COLUMN order_substitution_history.item_id IS 'ID del item sustituido';
COMMENT ON COLUMN order_substitution_history.substitution_type IS 'Tipo de sustitución (product_substitution, topping_substitution)';
COMMENT ON COLUMN order_substitution_history.original_name IS 'Nombre original del producto';
COMMENT ON COLUMN order_substitution_history.substitute_name IS 'Nombre del producto sustituto';
COMMENT ON COLUMN order_substitution_history.price_difference IS 'Diferencia de precio (positiva si aumenta, negativa si disminuye)';
COMMENT ON COLUMN order_substitution_history.parent_item_name IS 'Para toppings, nombre del plato padre que los contenía';

-- Función auxiliar para obtener sustituciones de una orden
CREATE OR REPLACE FUNCTION get_order_substitutions(p_orden_id INTEGER)
RETURNS TABLE(
  id UUID,
  substitution_type TEXT,
  original_name TEXT,
  substitute_name TEXT,
  price_difference DECIMAL(10,2),
  parent_item_name TEXT,
  applied_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    osh.id,
    osh.substitution_type,
    osh.original_name,
    osh.substitute_name,
    osh.price_difference,
    osh.parent_item_name,
    osh.applied_at
  FROM order_substitution_history osh
  WHERE osh.orden_id = p_orden_id
  ORDER BY osh.applied_at ASC;
$$;

COMMENT ON FUNCTION get_order_substitutions IS 'Función para obtener todas las sustituciones de una orden específica';