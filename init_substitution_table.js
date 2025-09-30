// Script para inicializar la tabla de historial de sustituciones
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzEzMDIsImV4cCI6MjA1MDU0NzMwMn0.e5kvH1fwRg8MKrcq2xUiPJ-xtcpLiRzKpqHCf6zCIBY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function initTable() {
  console.log('🔧 Creando tabla de historial de sustituciones...')

  try {
    // Ejecutar el SQL directamente
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'order_substitution_history')

    if (error) {
      console.error('Error verificando tabla:', error)
    } else if (!data || data.length === 0) {
      console.log('Tabla no existe, se debe crear manualmente en Supabase dashboard')
      console.log('SQL para crear la tabla:')
      console.log(`
CREATE TABLE order_substitution_history (
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

CREATE INDEX idx_substitution_history_orden_id ON order_substitution_history(orden_id);
CREATE INDEX idx_substitution_history_created_at ON order_substitution_history(created_at);

ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view substitution history" ON order_substitution_history
  FOR SELECT USING (true);

CREATE POLICY "Users can insert substitution history" ON order_substitution_history
  FOR INSERT WITH CHECK (true);
      `)
    } else {
      console.log('✅ Tabla ya existe:', data[0].table_name)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

initTable()