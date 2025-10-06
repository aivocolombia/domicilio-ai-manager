const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeChicharronPolloRule() {
  console.log('🔄 Eliminando regla incorrecta: Chicharrón ↔ Pollo...\n');

  try {
    // 1. Obtener IDs de toppings
    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .not('name', 'like', '%_DUPLICADO_%')
      .in('name', ['Chicharron', 'Pollo']);

    if (toppingsError) {
      console.error('❌ Error obteniendo toppings:', toppingsError);
      return;
    }

    const chicharron = toppings.find(t => t.name === 'Chicharron');
    const pollo = toppings.find(t => t.name === 'Pollo');

    if (!chicharron || !pollo) {
      console.log('⚠️ No se encontraron los toppings necesarios');
      return;
    }

    console.log('📍 Toppings encontrados:');
    console.log(`  - Chicharron: ID ${chicharron.id}`);
    console.log(`  - Pollo: ID ${pollo.id}`);

    // 2. Eliminar regla Chicharrón ↔ Pollo (en ambas direcciones)
    console.log('\n🗑️ Eliminando regla: Chicharrón → Pollo...');

    const { error: deleteError1 } = await supabase
      .from('product_substitution_rules')
      .delete()
      .eq('original_product_id', chicharron.id)
      .eq('original_product_type', 'topping')
      .eq('substitute_product_id', pollo.id)
      .eq('substitute_product_type', 'topping');

    if (deleteError1) {
      console.error('❌ Error eliminando regla Chicharrón → Pollo:', deleteError1);
    } else {
      console.log('✅ Regla eliminada: Chicharrón → Pollo');
    }

    // 3. Eliminar regla Pollo ↔ Chicharrón (dirección inversa)
    console.log('🗑️ Eliminando regla: Pollo → Chicharrón...');

    const { error: deleteError2 } = await supabase
      .from('product_substitution_rules')
      .delete()
      .eq('original_product_id', pollo.id)
      .eq('original_product_type', 'topping')
      .eq('substitute_product_id', chicharron.id)
      .eq('substitute_product_type', 'topping');

    if (deleteError2) {
      console.error('❌ Error eliminando regla Pollo → Chicharrón:', deleteError2);
    } else {
      console.log('✅ Regla eliminada: Pollo → Chicharrón');
    }

    // 4. Verificar reglas finales
    console.log('\n📋 Verificando reglas de sustitución finales...');

    const { data: allToppings, error: allToppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .not('name', 'like', '%_DUPLICADO_%');

    const { data: finalRules, error: finalRulesError } = await supabase
      .from('product_substitution_rules')
      .select('id, original_product_id, substitute_product_id, price_difference, is_bidirectional')
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping');

    if (finalRulesError || allToppingsError) {
      console.error('❌ Error obteniendo reglas finales');
    } else {
      console.log('\n🔄 Reglas de sustitución correctas (SIN Chicharrón ↔ Pollo):');
      finalRules.forEach(rule => {
        const originalTopping = allToppings.find(t => t.id === rule.original_product_id);
        const substituteTopping = allToppings.find(t => t.id === rule.substitute_product_id);

        if (originalTopping && substituteTopping) {
          const priceText = rule.price_difference === 0 ? 'GRATUITA' : `$${rule.price_difference}`;
          const directionText = rule.is_bidirectional ? '↔' : '→';
          console.log(`  - ${originalTopping.name} ${directionText} ${substituteTopping.name} (${priceText})`);
        }
      });

      // Mostrar específicamente las reglas de Chicharrón
      const chicharronRules = finalRules.filter(rule =>
        rule.original_product_id === chicharron.id || rule.substitute_product_id === chicharron.id
      );

      console.log('\n🎯 Reglas específicas de Chicharrón:');
      if (chicharronRules.length === 0) {
        console.log('  - ¡NINGUNA REGLA CHICHARRÓN ↔ POLLO! ✅');
      }
      chicharronRules.forEach(rule => {
        const originalTopping = allToppings.find(t => t.id === rule.original_product_id);
        const substituteTopping = allToppings.find(t => t.id === rule.substitute_product_id);

        if (originalTopping && substituteTopping) {
          const priceText = rule.price_difference === 0 ? 'GRATUITA' : `$${rule.price_difference}`;
          const directionText = rule.is_bidirectional ? '↔' : '→';
          console.log(`  - ${originalTopping.name} ${directionText} ${substituteTopping.name} (${priceText})`);
        }
      });
    }

    console.log('\n✅ Regla incorrecta eliminada!');
    console.log('\n📝 Ahora Chicharrón solo puede cambiarse por:');
    console.log('   • Carne en polvo (correcto)');
    console.log('   • NO por Pollo (eliminado)');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

removeChicharronPolloRule();