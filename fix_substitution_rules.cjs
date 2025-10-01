const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSubstitutionRules() {
  console.log('🔄 Corrigiendo reglas de sustitución...\n');

  try {
    // Mappings de duplicados a los IDs válidos
    const duplicateMapping = {
      5: 2, // Mazorca_DUPLICADO_5 → Mazorca (ID 2)
      9: 8, // Carne en polvo_DUPLICADO_9 → Carne en polvo (ID 8)
      15: 13, // Cazuela frijol_DUPLICADO_15 → Cazuela frijol (ID 13)
      16: 13  // Cazuela frijol_DUPLICADO_16 → Cazuela frijol (ID 13)
    };

    for (const [duplicateId, validId] of Object.entries(duplicateMapping)) {
      console.log(`🔧 Corrigiendo reglas que usan ID ${duplicateId} → ID ${validId}`);

      // Actualizar reglas donde el duplicado es el producto original
      const { error: updateOriginalError } = await supabase
        .from('product_substitution_rules')
        .update({ original_product_id: parseInt(validId) })
        .eq('original_product_id', parseInt(duplicateId))
        .eq('original_product_type', 'topping');

      if (updateOriginalError) {
        console.error(`  ❌ Error actualizando reglas (original) para ID ${duplicateId}:`, updateOriginalError);
      } else {
        console.log(`  ✅ Reglas (original) actualizadas: ${duplicateId} → ${validId}`);
      }

      // Actualizar reglas donde el duplicado es el producto sustituto
      const { error: updateSubstituteError } = await supabase
        .from('product_substitution_rules')
        .update({ substitute_product_id: parseInt(validId) })
        .eq('substitute_product_id', parseInt(duplicateId))
        .eq('substitute_product_type', 'topping');

      if (updateSubstituteError) {
        console.error(`  ❌ Error actualizando reglas (substitute) para ID ${duplicateId}:`, updateSubstituteError);
      } else {
        console.log(`  ✅ Reglas (substitute) actualizadas: ${duplicateId} → ${validId}`);
      }
    }

    // Eliminar reglas duplicadas que podrían haberse creado
    console.log('\n🧹 Eliminando reglas duplicadas...');

    // Obtener todas las reglas de toppings
    const { data: allRules, error: rulesError } = await supabase
      .from('product_substitution_rules')
      .select('*')
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping')
      .order('id');

    if (rulesError) {
      console.error('❌ Error obteniendo reglas:', rulesError);
      return;
    }

    // Agrupar reglas por combinación única de original_product_id + substitute_product_id
    const ruleGroups = {};
    allRules.forEach(rule => {
      const key = `${rule.original_product_id}_${rule.substitute_product_id}`;
      if (!ruleGroups[key]) {
        ruleGroups[key] = [];
      }
      ruleGroups[key].push(rule);
    });

    // Eliminar duplicados (mantener el de menor ID)
    for (const [key, rules] of Object.entries(ruleGroups)) {
      if (rules.length > 1) {
        // Ordenar por ID y mantener el primero
        rules.sort((a, b) => a.id - b.id);
        const keepRule = rules[0];
        const duplicateRules = rules.slice(1);

        console.log(`🔍 Encontrado grupo duplicado ${key}:`);
        console.log(`  ✅ Mantener: ID ${keepRule.id}`);
        console.log(`  ❌ Eliminar: IDs ${duplicateRules.map(r => r.id).join(', ')}`);

        for (const dupRule of duplicateRules) {
          const { error: deleteError } = await supabase
            .from('product_substitution_rules')
            .delete()
            .eq('id', dupRule.id);

          if (deleteError) {
            console.error(`    ❌ Error eliminando regla ID ${dupRule.id}:`, deleteError);
          } else {
            console.log(`    ✅ Regla eliminada: ID ${dupRule.id}`);
          }
        }
      }
    }

    console.log('\n✅ Corrección de reglas completada!');

    // Verificar resultado final
    console.log('\n📋 Verificando resultado final...');
    const { data: finalRules, error: finalError } = await supabase
      .from('product_substitution_rules')
      .select('id, original_product_id, substitute_product_id, price_difference, is_bidirectional')
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping');

    if (finalError) {
      console.error('❌ Error obteniendo resultado final:', finalError);
    } else {
      // Obtener nombres de toppings válidos
      const { data: toppings, error: toppingsError } = await supabase
        .from('toppings')
        .select('id, name')
        .not('name', 'like', '%_DUPLICADO_%');

      if (!toppingsError) {
        console.log('\n🔄 Reglas de sustitución finales:');
        finalRules.forEach(rule => {
          const originalTopping = toppings.find(t => t.id === rule.original_product_id);
          const substituteTopping = toppings.find(t => t.id === rule.substitute_product_id);

          if (originalTopping && substituteTopping) {
            console.log(`  - ${originalTopping.name} ↔ ${substituteTopping.name} (Precio: ${rule.price_difference}, Bidireccional: ${rule.is_bidirectional})`);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixSubstitutionRules();