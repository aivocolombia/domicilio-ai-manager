import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Usar las mismas credenciales que la aplicación
const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDk3MTMwMiwiZXhwIjoyMDUwNTQ3MzAyfQ.fvEgP5V1dKbhz6dLdlS7FKnJz7lEXFkiCu9a7HjUm1U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('🔧 Creando tabla de historial de sustituciones...');

  try {
    // Crear la tabla directamente con SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
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

        -- Crear índices
        CREATE INDEX IF NOT EXISTS idx_substitution_history_orden_id
          ON order_substitution_history(orden_id);

        CREATE INDEX IF NOT EXISTS idx_substitution_history_created_at
          ON order_substitution_history(created_at);

        -- RLS
        ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Users can view substitution history" ON order_substitution_history;
        CREATE POLICY "Users can view substitution history" ON order_substitution_history
          FOR SELECT USING (true);

        DROP POLICY IF EXISTS "Users can insert substitution history" ON order_substitution_history;
        CREATE POLICY "Users can insert substitution history" ON order_substitution_history
          FOR INSERT WITH CHECK (true);
      `
    });

    if (error) {
      console.error('❌ Error:', error);

      // Intentar método alternativo con SQL directo
      console.log('🔄 Intentando método alternativo...');

      const createTableSQL = `
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
      `;

      const { error: error2 } = await supabase.from('_temp').select('1').limit(1);
      console.log('Conexión a Supabase:', error2 ? 'ERROR' : 'OK');

      console.log(`
      ⚠️  La tabla no se pudo crear automáticamente.

      Por favor, ejecuta manualmente en el SQL Editor de Supabase:

      ${createTableSQL}

      CREATE INDEX IF NOT EXISTS idx_substitution_history_orden_id ON order_substitution_history(orden_id);

      ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Users can view substitution history" ON order_substitution_history FOR SELECT USING (true);
      CREATE POLICY "Users can insert substitution history" ON order_substitution_history FOR INSERT WITH CHECK (true);
      `);

    } else {
      console.log('✅ Tabla creada exitosamente');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.log(`
    ⚠️  Para crear la tabla manualmente, ejecuta en Supabase SQL Editor:

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

    CREATE INDEX IF NOT EXISTS idx_substitution_history_orden_id ON order_substitution_history(orden_id);
    ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view substitution history" ON order_substitution_history FOR SELECT USING (true);
    CREATE POLICY "Users can insert substitution history" ON order_substitution_history FOR INSERT WITH CHECK (true);
    `);
  }
}

createTable();