-- ===================================================================
-- EJECUTAR ESTE CÓDIGO EN SUPABASE SQL EDITOR PARA CREAR LA TABLA
-- DE HISTORIAL DE SUSTITUCIONES
-- ===================================================================

-- Crear tabla principal para historial de sustituciones
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

-- Habilitar Row Level Security
ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
DROP POLICY IF EXISTS "Users can view substitution history" ON order_substitution_history;
CREATE POLICY "Users can view substitution history" ON order_substitution_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert substitution history" ON order_substitution_history;
CREATE POLICY "Users can insert substitution history" ON order_substitution_history
  FOR INSERT WITH CHECK (true);

-- Verificar que la tabla se creó correctamente
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'order_substitution_history'
ORDER BY ordinal_position;