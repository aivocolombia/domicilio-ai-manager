const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function safeCleanup() {
  console.log('🔄 Iniciando limpieza segura de duplicados...\n');

  try {
    // Estrategia: En lugar de eliminar duplicados, vamos a desactivar los que no se están usando
    // y mantener solo los que tienen el ID más bajo para cada nombre

    // 1. Identificar duplicados específicos que causan problemas
    const problematicDuplicates = [
      { name: 'Mazorca', keepId: 2, removeIds: [5] },
      { name: 'Carne en polvo', keepId: 8, removeIds: [9] },
      { name: 'Cazuela frijol', keepId: 13, removeIds: [15, 16] }
    ];

    for (const duplicate of problematicDuplicates) {
      console.log(`\n🔧 Procesando "${duplicate.name}"`);
      console.log(`  ✅ Mantener: ID ${duplicate.keepId}`);
      console.log(`  🔄 Procesando: IDs ${duplicate.removeIds.join(', ')}`);

      for (const removeId of duplicate.removeIds) {
        // Estrategia: En lugar de eliminar, vamos a "desactivar" añadiendo un sufijo al nombre
        // para que no aparezcan en las consultas normales
        const newName = `${duplicate.name}_DUPLICADO_${removeId}`;

        const { error: renameError } = await supabase
          .from('toppings')
          .update({ name: newName })
          .eq('id', removeId);

        if (renameError) {
          console.error(`    ❌ Error renombrando ID ${removeId}:`, renameError);
        } else {
          console.log(`    ✅ ID ${removeId} renombrado a: ${newName}`);
        }
      }
    }

    // 2. Verificar resultado
    const { data: finalToppings, error: finalError } = await supabase
      .from('toppings')
      .select('id, name')
      .not('name', 'like', '%_DUPLICADO_%')
      .order('name');

    if (finalError) {
      console.error('❌ Error obteniendo resultado final:', finalError);
    } else {
      console.log('\n📋 Toppings activos (sin duplicados):');
      finalToppings.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
    }

    // 3. Verificar toppings marcados como duplicados
    const { data: duplicatedToppings, error: duplicatedError } = await supabase
      .from('toppings')
      .select('id, name')
      .like('name', '%_DUPLICADO_%')
      .order('id');

    if (!duplicatedError && duplicatedToppings.length > 0) {
      console.log('\n🗂️ Toppings marcados como duplicados (ocultos):');
      duplicatedToppings.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
    }

    console.log('\n✅ Limpieza completada! Los duplicados han sido marcados y no aparecerán en la interfaz.');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

safeCleanup();