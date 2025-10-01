const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addMissingRules() {
  console.log('🔄 Agregando reglas de sustitución faltantes...\n');

  try {
    // Obtener IDs de toppings válidos
    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .not('name', 'like', '%_DUPLICADO_%')
      .in('name', ['Arroz', 'Aguacate', 'Mazorca']);

    if (toppingsError) {
      console.error('❌ Error obteniendo toppings:', toppingsError);
      return;
    }

    const toppingMap = {};
    toppings.forEach(t => {
      toppingMap[t.name] = t.id;
    });

    console.log('📋 Toppings encontrados:', toppingMap);

    // Reglas que necesitamos agregar (GRATUITAS)
    const newRules = [];

    // Arroz → Mazorca (gratuita, bidireccional)
    if (toppingMap['Arroz'] && toppingMap['Mazorca']) {
      newRules.push({
        original_product_id: toppingMap['Arroz'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Mazorca'],
        substitute_product_type: 'topping',
        price_difference: 0, // GRATUITA
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Arroz → Mazorca (gratuita)');
    }

    // Aguacate → Mazorca (gratuita, bidireccional)
    if (toppingMap['Aguacate'] && toppingMap['Mazorca']) {
      newRules.push({
        original_product_id: toppingMap['Aguacate'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Mazorca'],
        substitute_product_type: 'topping',
        price_difference: 0, // GRATUITA
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Aguacate → Mazorca (gratuita)');
    }

    if (newRules.length === 0) {
      console.log('ℹ️ No hay reglas nuevas que agregar');
      return;
    }

    // Insertar reglas nuevas
    console.log('\n➕ Insertando reglas nuevas...');
    const { data: insertedRules, error: insertError } = await supabase
      .from('product_substitution_rules')
      .upsert(newRules, {
        onConflict: 'original_product_id,original_product_type,substitute_product_id,substitute_product_type'
      })
      .select();

    if (insertError) {
      console.error('❌ Error insertando reglas:', insertError);
    } else {
      console.log(`✅ ${newRules.length} reglas agregadas/actualizadas`);
    }

    // Verificar resultado final
    console.log('\n📋 Verificando reglas finales...');
    const { data: finalRules, error: finalError } = await supabase
      .from('product_substitution_rules')
      .select('id, original_product_id, substitute_product_id, price_difference, is_bidirectional')
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping');

    if (finalError) {
      console.error('❌ Error obteniendo reglas finales:', finalError);
    } else {
      console.log('\n🔄 Todas las reglas de sustitución de toppings:');
      finalRules.forEach(rule => {
        const originalTopping = toppings.find(t => t.id === rule.original_product_id);
        const substituteTopping = toppings.find(t => t.id === rule.substitute_product_id);

        if (originalTopping && substituteTopping) {
          const priceText = rule.price_difference === 0 ? 'GRATUITA' : `$${rule.price_difference}`;
          console.log(`  - ${originalTopping.name} ↔ ${substituteTopping.name} (${priceText}, Bidireccional: ${rule.is_bidirectional})`);
        }
      });
    }

    console.log('\n✅ Proceso completado!');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addMissingRules();