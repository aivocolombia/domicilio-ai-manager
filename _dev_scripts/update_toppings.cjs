const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateToppings() {
  console.log('🔄 Iniciando actualización de toppings...');

  try {
    // 1. Cambiar nombres de toppings
    console.log('\n1️⃣ Actualizando nombres de toppings...');

    // Cambiar "Chicharrón" a "Carne en polvo"
    const { data: chicharronUpdate, error: chicharronError } = await supabase
      .from('toppings')
      .update({ name: 'Carne en polvo' })
      .eq('name', 'Chicharrón');

    if (chicharronError) {
      console.error('❌ Error actualizando Chicharrón:', chicharronError);
    } else {
      console.log('✅ Chicharrón → Carne en polvo');
    }

    // Cambiar "Plátanitos" a "Mazorca"
    const { data: platanitosUpdate, error: platanitosError } = await supabase
      .from('toppings')
      .update({ name: 'Mazorca' })
      .eq('name', 'Plátanitos');

    if (platanitosError) {
      console.error('❌ Error actualizando Plátanitos:', platanitosError);
    } else {
      console.log('✅ Plátanitos → Mazorca');
    }

    // 2. Obtener IDs de toppings necesarios
    console.log('\n2️⃣ Obteniendo IDs de toppings...');

    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .in('name', ['Arroz', 'Aguacate', 'Plátanitos', 'Mazorca']);

    if (toppingsError) {
      console.error('❌ Error obteniendo toppings:', toppingsError);
      return;
    }

    const toppingMap = {};
    toppings.forEach(t => {
      toppingMap[t.name] = t.id;
    });

    console.log('📋 Toppings encontrados:', toppingMap);

    // 3. Agregar nuevas reglas de sustitución
    console.log('\n3️⃣ Agregando nuevas reglas de sustitución...');

    const rulesToAdd = [];

    // Arroz -> Plátanitos (si existe)
    if (toppingMap['Arroz'] && toppingMap['Plátanitos']) {
      rulesToAdd.push({
        original_product_id: toppingMap['Arroz'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Plátanitos'],
        substitute_product_type: 'topping',
        price_difference: 0,
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Arroz -> Plátanitos');
    }

    // Aguacate -> Plátanitos (si existe)
    if (toppingMap['Aguacate'] && toppingMap['Plátanitos']) {
      rulesToAdd.push({
        original_product_id: toppingMap['Aguacate'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Plátanitos'],
        substitute_product_type: 'topping',
        price_difference: 0,
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Aguacate -> Plátanitos');
    }

    // Arroz -> Mazorca
    if (toppingMap['Arroz'] && toppingMap['Mazorca']) {
      rulesToAdd.push({
        original_product_id: toppingMap['Arroz'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Mazorca'],
        substitute_product_type: 'topping',
        price_difference: 0,
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Arroz -> Mazorca');
    }

    // Aguacate -> Mazorca
    if (toppingMap['Aguacate'] && toppingMap['Mazorca']) {
      rulesToAdd.push({
        original_product_id: toppingMap['Aguacate'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Mazorca'],
        substitute_product_type: 'topping',
        price_difference: 0,
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Aguacate -> Mazorca');
    }

    // Insertar reglas
    if (rulesToAdd.length > 0) {
      const { data: rulesData, error: rulesError } = await supabase
        .from('product_substitution_rules')
        .upsert(rulesToAdd, {
          onConflict: 'original_product_id,original_product_type,substitute_product_id,substitute_product_type'
        });

      if (rulesError) {
        console.error('❌ Error insertando reglas:', rulesError);
      } else {
        console.log(`✅ ${rulesToAdd.length} reglas de sustitución agregadas/actualizadas`);
      }
    }

    // 4. Verificar resultados
    console.log('\n4️⃣ Verificando resultados...');

    // Mostrar toppings actualizados
    const { data: finalToppings, error: finalError } = await supabase
      .from('toppings')
      .select('id, name')
      .in('name', ['Carne en polvo', 'Mazorca', 'Plátanitos', 'Arroz', 'Aguacate'])
      .order('name');

    if (finalError) {
      console.error('❌ Error verificando toppings:', finalError);
    } else {
      console.log('\n📋 Toppings finales:');
      finalToppings.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
    }

    // Mostrar reglas relevantes
    const { data: relevantRules, error: rulesQueryError } = await supabase
      .from('product_substitution_rules')
      .select(`
        id,
        price_difference,
        is_bidirectional,
        original_toppings:toppings!product_substitution_rules_original_product_id_fkey(name),
        substitute_toppings:toppings!product_substitution_rules_substitute_product_id_fkey(name)
      `)
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping');

    if (rulesQueryError) {
      console.error('❌ Error consultando reglas:', rulesQueryError);
    } else {
      console.log('\n🔄 Reglas de sustitución relevantes:');
      relevantRules
        .filter(rule =>
          ['Arroz', 'Aguacate'].includes(rule.original_toppings?.name) ||
          ['Plátanitos', 'Mazorca', 'Carne en polvo'].includes(rule.substitute_toppings?.name)
        )
        .forEach(rule => {
          console.log(`  - ${rule.original_toppings?.name} ↔ ${rule.substitute_toppings?.name} (Bidireccional: ${rule.is_bidirectional})`);
        });
    }

    console.log('\n✅ Actualización completada!');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

updateToppings();