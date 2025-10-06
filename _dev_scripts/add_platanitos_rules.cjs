const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPlatanitoRules() {
  console.log('🔄 Agregando Plátanitos y reglas de sustitución...\n');

  try {
    // 1. Verificar si existe "Plátanitos" como topping
    const { data: existingPlatanitos, error: searchError } = await supabase
      .from('toppings')
      .select('id, name')
      .eq('name', 'Plátanitos')
      .not('name', 'like', '%_DUPLICADO_%')
      .maybeSingle();

    if (searchError) {
      console.error('❌ Error buscando Plátanitos:', searchError);
      return;
    }

    let platanitoId;

    if (existingPlatanitos) {
      console.log(`✅ Plátanitos ya existe con ID: ${existingPlatanitos.id}`);
      platanitoId = existingPlatanitos.id;
    } else {
      // 2. Crear el topping "Plátanitos" si no existe
      console.log('➕ Creando topping "Plátanitos"...');
      const { data: newPlatanito, error: createError } = await supabase
        .from('toppings')
        .insert([{
          name: 'Plátanitos',
          pricing: 0 // Precio base
        }])
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creando Plátanitos:', createError);
        return;
      } else {
        console.log(`✅ Plátanitos creado con ID: ${newPlatanito.id}`);
        platanitoId = newPlatanito.id;
      }
    }

    // 3. Obtener IDs de otros toppings necesarios
    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .not('name', 'like', '%_DUPLICADO_%')
      .in('name', ['Arroz', 'Aguacate', 'Mazorca', 'Carne en polvo']);

    if (toppingsError) {
      console.error('❌ Error obteniendo toppings:', toppingsError);
      return;
    }

    const toppingMap = {};
    toppings.forEach(t => {
      toppingMap[t.name] = t.id;
    });
    toppingMap['Plátanitos'] = platanitoId;

    console.log('📋 Toppings encontrados:', toppingMap);

    // 4. Crear todas las reglas de sustitución solicitadas (GRATUITAS)
    const newRules = [];

    // Reglas ya existentes que queremos asegurar:
    // Arroz → Mazorca (ya existe)
    // Aguacate → Mazorca (ya existe)

    // NUEVAS reglas solicitadas:

    // Arroz → Plátanitos
    if (toppingMap['Arroz'] && toppingMap['Plátanitos']) {
      newRules.push({
        original_product_id: toppingMap['Arroz'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Plátanitos'],
        substitute_product_type: 'topping',
        price_difference: 0,
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Arroz ↔ Plátanitos');
    }

    // Aguacate → Plátanitos
    if (toppingMap['Aguacate'] && toppingMap['Plátanitos']) {
      newRules.push({
        original_product_id: toppingMap['Aguacate'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Plátanitos'],
        substitute_product_type: 'topping',
        price_difference: 0,
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Aguacate ↔ Plátanitos');
    }

    // Plátanitos → Mazorca (para cuando alguien tenga Plátanitos y lo quiera cambiar)
    if (toppingMap['Plátanitos'] && toppingMap['Mazorca']) {
      newRules.push({
        original_product_id: toppingMap['Plátanitos'],
        original_product_type: 'topping',
        substitute_product_id: toppingMap['Mazorca'],
        substitute_product_type: 'topping',
        price_difference: 0,
        is_bidirectional: true
      });
      console.log('📝 Preparando regla: Plátanitos ↔ Mazorca');
    }

    // Las reglas de Carne en polvo ya deberían existir
    // Carne en polvo ↔ Pollo (ya existe según verificación anterior)

    if (newRules.length === 0) {
      console.log('ℹ️ No hay reglas nuevas que agregar');
    } else {
      // 5. Insertar las nuevas reglas
      console.log(`\n➕ Insertando ${newRules.length} reglas nuevas...`);
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
    }

    // 6. Verificar todas las reglas finales
    console.log('\n📋 Verificando todas las reglas de sustitución...');
    const { data: allRules, error: rulesError } = await supabase
      .from('product_substitution_rules')
      .select('id, original_product_id, substitute_product_id, price_difference, is_bidirectional')
      .eq('original_product_type', 'topping')
      .eq('substitute_product_type', 'topping');

    if (rulesError) {
      console.error('❌ Error obteniendo reglas:', rulesError);
    } else {
      // Obtener todos los toppings válidos para mostrar nombres
      const { data: allToppings, error: allToppingsError } = await supabase
        .from('toppings')
        .select('id, name')
        .not('name', 'like', '%_DUPLICADO_%');

      if (!allToppingsError) {
        console.log('\n🔄 TODAS las reglas de sustitución de toppings (válidas):');
        allRules.forEach(rule => {
          const originalTopping = allToppings.find(t => t.id === rule.original_product_id);
          const substituteTopping = allToppings.find(t => t.id === rule.substitute_product_id);

          if (originalTopping && substituteTopping) {
            const priceText = rule.price_difference === 0 ? 'GRATUITA' : `$${rule.price_difference}`;
            const directionText = rule.is_bidirectional ? '↔' : '→';
            console.log(`  - ${originalTopping.name} ${directionText} ${substituteTopping.name} (${priceText})`);
          }
        });
      }
    }

    console.log('\n✅ Proceso completado!');
    console.log('\n📝 Resumen de sustituciones disponibles:');
    console.log('   • Chicharrón → Carne en polvo (en platos que lo tengan)');
    console.log('   • Plátanitos → Mazorca (en platos que lo tengan)');
    console.log('   • Arroz → Plátanitos (nuevo)');
    console.log('   • Aguacate → Plátanitos (nuevo)');
    console.log('   • Arroz → Mazorca (existente)');
    console.log('   • Aguacate → Mazorca (existente)');
    console.log('   • Carne en polvo → Pollo (existente)');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addPlatanitoRules();