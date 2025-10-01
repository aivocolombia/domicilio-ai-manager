const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixChicharronIssue() {
  console.log('🔄 Solucionando problema con Chicharron...\n');

  try {
    // 1. Verificar el estado actual
    console.log('1️⃣ Verificando estado actual...');
    const { data: allToppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .not('name', 'like', '%_DUPLICADO_%')
      .order('name');

    if (toppingsError) {
      console.error('❌ Error obteniendo toppings:', toppingsError);
      return;
    }

    console.log('📋 Toppings encontrados:');
    allToppings.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));

    // Buscar específicamente Chicharron y Carne en polvo
    const chicharron = allToppings.find(t => t.name === 'Chicharron');
    const carneEnPolvo = allToppings.find(t => t.name === 'Carne en polvo');
    const pollo = allToppings.find(t => t.name === 'Pollo');

    console.log('\n📍 Toppings relevantes:');
    console.log(`  - Chicharron: ${chicharron ? `ID ${chicharron.id}` : 'NO ENCONTRADO'}`);
    console.log(`  - Carne en polvo: ${carneEnPolvo ? `ID ${carneEnPolvo.id}` : 'NO ENCONTRADO'}`);
    console.log(`  - Pollo: ${pollo ? `ID ${pollo.id}` : 'NO ENCONTRADO'}`);

    if (!chicharron) {
      console.log('✅ No hay problema - Chicharron no existe');
      return;
    }

    if (!carneEnPolvo) {
      console.error('❌ Error: No se encontró "Carne en polvo"');
      return;
    }

    if (!pollo) {
      console.error('❌ Error: No se encontró "Pollo"');
      return;
    }

    // 2. Opción A: Crear regla directa Chicharron → Carne en polvo
    console.log('\n2️⃣ Creando regla de sustitución: Chicharron → Carne en polvo...');

    const substitutionRule = {
      original_product_id: chicharron.id,
      original_product_type: 'topping',
      substitute_product_id: carneEnPolvo.id,
      substitute_product_type: 'topping',
      price_difference: 0, // Gratuito
      is_bidirectional: true
    };

    const { error: ruleError } = await supabase
      .from('product_substitution_rules')
      .upsert([substitutionRule], {
        onConflict: 'original_product_id,original_product_type,substitute_product_id,substitute_product_type'
      });

    if (ruleError) {
      console.error('❌ Error creando regla Chicharron → Carne en polvo:', ruleError);
    } else {
      console.log('✅ Regla creada: Chicharron ↔ Carne en polvo (gratuita)');
    }

    // 3. También crear regla directa Chicharron → Pollo para mayor flexibilidad
    console.log('\n3️⃣ Creando regla adicional: Chicharron → Pollo...');

    const chicharronPolloRule = {
      original_product_id: chicharron.id,
      original_product_type: 'topping',
      substitute_product_id: pollo.id,
      substitute_product_type: 'topping',
      price_difference: 0, // Gratuito
      is_bidirectional: true
    };

    const { error: polloRuleError } = await supabase
      .from('product_substitution_rules')
      .upsert([chicharronPolloRule], {
        onConflict: 'original_product_id,original_product_type,substitute_product_id,substitute_product_type'
      });

    if (polloRuleError) {
      console.error('❌ Error creando regla Chicharron → Pollo:', polloRuleError);
    } else {
      console.log('✅ Regla creada: Chicharron ↔ Pollo (gratuita)');
    }

    // 4. Verificar todas las reglas de sustitución actuales
    console.log('\n4️⃣ Verificando todas las reglas de sustitución...');
    const { data: finalRules, error: finalRulesError } = await supabase
      .from('product_substitution_rules')
      .select('id, original_product_id, substitute_product_id, price_difference, is_bidirectional')
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping');

    if (finalRulesError) {
      console.error('❌ Error obteniendo reglas finales:', finalRulesError);
    } else {
      console.log('\n🔄 Todas las reglas de sustitución (incluyendo Chicharron):');
      finalRules.forEach(rule => {
        const originalTopping = allToppings.find(t => t.id === rule.original_product_id);
        const substituteTopping = allToppings.find(t => t.id === rule.substitute_product_id);

        if (originalTopping && substituteTopping) {
          const priceText = rule.price_difference === 0 ? 'GRATUITA' : `$${rule.price_difference}`;
          const directionText = rule.is_bidirectional ? '↔' : '→';
          console.log(`  - ${originalTopping.name} ${directionText} ${substituteTopping.name} (${priceText})`);
        }
      });
    }

    console.log('\n✅ Problema con Chicharron solucionado!');
    console.log('\n📝 Ahora deberías poder:');
    console.log('   • Cambiar Chicharron → Carne en polvo (gratuito)');
    console.log('   • Cambiar Chicharron → Pollo (gratuito)');
    console.log('   • Cambiar Carne en polvo → Pollo (regla existente)');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixChicharronIssue();