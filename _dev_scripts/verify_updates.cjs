const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyUpdates() {
  console.log('🔍 Verificando estado actual...\n');

  try {
    // Verificar toppings (solo los válidos, sin duplicados)
    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .not('name', 'like', '%_DUPLICADO_%')
      .order('name');

    if (toppingsError) {
      console.error('❌ Error obteniendo toppings:', toppingsError);
    } else {
      console.log('📋 Toppings actuales:');
      toppings.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
    }

    // Verificar reglas de sustitución de toppings
    const { data: rules, error: rulesError } = await supabase
      .from('product_substitution_rules')
      .select('id, original_product_id, substitute_product_id, price_difference, is_bidirectional')
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping');

    if (rulesError) {
      console.error('❌ Error obteniendo reglas:', rulesError);
    } else {
      console.log('\n🔄 Reglas de sustitución de toppings:');
      for (const rule of rules) {
        // Obtener nombres de toppings
        const originalTopping = toppings.find(t => t.id === rule.original_product_id);
        const substituteTopping = toppings.find(t => t.id === rule.substitute_product_id);

        if (originalTopping && substituteTopping) {
          console.log(`  - ${originalTopping.name} ↔ ${substituteTopping.name} (Precio: ${rule.price_difference}, Bidireccional: ${rule.is_bidirectional})`);
        } else if (!originalTopping || !substituteTopping) {
          // Regla hace referencia a topping duplicado/inválido - mostrar como advertencia
          console.log(`  ⚠️ Regla inválida: original_id=${rule.original_product_id}, substitute_id=${rule.substitute_product_id} (hace referencia a duplicado)`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

verifyUpdates();