const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
  console.log('🔄 Iniciando limpieza de duplicados...\n');

  try {
    // 1. Obtener todos los toppings
    const { data: allToppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .order('id');

    if (toppingsError) {
      console.error('❌ Error obteniendo toppings:', toppingsError);
      return;
    }

    console.log('📋 Toppings actuales:');
    allToppings.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));

    // 2. Identificar duplicados
    const toppingGroups = {};
    allToppings.forEach(topping => {
      if (!toppingGroups[topping.name]) {
        toppingGroups[topping.name] = [];
      }
      toppingGroups[topping.name].push(topping);
    });

    console.log('\n🔍 Identificando duplicados...');
    const duplicates = Object.entries(toppingGroups).filter(([name, group]) => group.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ No se encontraron duplicados');
      return;
    }

    console.log('\n⚠️ Duplicados encontrados:');
    duplicates.forEach(([name, group]) => {
      console.log(`  - ${name}: ${group.map(t => `ID ${t.id}`).join(', ')}`);
    });

    // 3. Para cada grupo de duplicados, mantener el de menor ID y eliminar los demás
    for (const [name, group] of duplicates) {
      // Ordenar por ID para mantener el menor
      group.sort((a, b) => a.id - b.id);
      const keepTopping = group[0];
      const deleteIds = group.slice(1).map(t => t.id);

      console.log(`\n🔧 Procesando "${name}"`);
      console.log(`  ✅ Mantener: ID ${keepTopping.id}`);
      console.log(`  ❌ Eliminar: IDs ${deleteIds.join(', ')}`);

      // 4. Actualizar referencias en otras tablas antes de eliminar
      console.log('  🔄 Actualizando referencias...');

      // Actualizar plato_toppings
      for (const deleteId of deleteIds) {
        const { error: updatePlatoToppingsError } = await supabase
          .from('plato_toppings')
          .update({ topping_id: keepTopping.id })
          .eq('topping_id', deleteId);

        if (updatePlatoToppingsError) {
          console.error(`    ❌ Error actualizando plato_toppings para ID ${deleteId}:`, updatePlatoToppingsError);
        } else {
          console.log(`    ✅ plato_toppings actualizado: ${deleteId} → ${keepTopping.id}`);
        }
      }

      // Actualizar sede_toppings
      for (const deleteId of deleteIds) {
        const { error: updateSedeToppingsError } = await supabase
          .from('sede_toppings')
          .update({ topping_id: keepTopping.id })
          .eq('topping_id', deleteId);

        if (updateSedeToppingsError) {
          console.error(`    ❌ Error actualizando sede_toppings para ID ${deleteId}:`, updateSedeToppingsError);
        } else {
          console.log(`    ✅ sede_toppings actualizado: ${deleteId} → ${keepTopping.id}`);
        }
      }

      // Actualizar reglas de sustitución (original_product_id)
      for (const deleteId of deleteIds) {
        const { error: updateRulesOriginalError } = await supabase
          .from('product_substitution_rules')
          .update({ original_product_id: keepTopping.id })
          .eq('original_product_id', deleteId)
          .eq('original_product_type', 'topping');

        if (updateRulesOriginalError) {
          console.error(`    ❌ Error actualizando reglas (original) para ID ${deleteId}:`, updateRulesOriginalError);
        } else {
          console.log(`    ✅ reglas de sustitución (original) actualizado: ${deleteId} → ${keepTopping.id}`);
        }
      }

      // Actualizar reglas de sustitución (substitute_product_id)
      for (const deleteId of deleteIds) {
        const { error: updateRulesSubstituteError } = await supabase
          .from('product_substitution_rules')
          .update({ substitute_product_id: keepTopping.id })
          .eq('substitute_product_id', deleteId)
          .eq('substitute_product_type', 'topping');

        if (updateRulesSubstituteError) {
          console.error(`    ❌ Error actualizando reglas (substitute) para ID ${deleteId}:`, updateRulesSubstituteError);
        } else {
          console.log(`    ✅ reglas de sustitución (substitute) actualizado: ${deleteId} → ${keepTopping.id}`);
        }
      }

      // 5. Eliminar los toppings duplicados
      for (const deleteId of deleteIds) {
        const { error: deleteError } = await supabase
          .from('toppings')
          .delete()
          .eq('id', deleteId);

        if (deleteError) {
          console.error(`    ❌ Error eliminando topping ID ${deleteId}:`, deleteError);
        } else {
          console.log(`    ✅ Topping eliminado: ID ${deleteId}`);
        }
      }
    }

    console.log('\n✅ Limpieza de duplicados completada!');

    // 6. Verificar resultado final
    const { data: finalToppings, error: finalError } = await supabase
      .from('toppings')
      .select('id, name')
      .order('name');

    if (finalError) {
      console.error('❌ Error obteniendo estado final:', finalError);
    } else {
      console.log('\n📋 Toppings finales:');
      finalToppings.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

cleanupDuplicates();