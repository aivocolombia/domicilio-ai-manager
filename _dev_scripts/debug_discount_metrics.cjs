const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDiscountMetrics() {
  console.log('🧪 Debugging discount metrics...\n');

  try {
    // 1. Check if there are any discounts applied
    console.log('1️⃣ Checking for orders with discounts...');
    const { data: allDiscounts, error: allError } = await supabase
      .from('ordenes')
      .select(`
        id,
        status,
        descuento_valor,
        descuento_comentario,
        descuento_aplicado_por,
        descuento_aplicado_fecha,
        sede_id,
        created_at,
        sedes!sede_id(name)
      `)
      .not('descuento_valor', 'is', null)
      .gt('descuento_valor', 0)
      .order('descuento_aplicado_fecha', { ascending: false })
      .limit(10);

    if (allError) {
      console.error('❌ Error getting discounts:', allError);
      return;
    }

    if (!allDiscounts || allDiscounts.length === 0) {
      console.log('⚠️ No discounts found in database');

      // Check if there are any orders with discount fields set to zero or null
      const { data: possibleDiscounts, error: possibleError } = await supabase
        .from('ordenes')
        .select('id, descuento_valor, descuento_comentario, descuento_aplicado_fecha')
        .limit(5);

      if (!possibleError && possibleDiscounts) {
        console.log('\n📋 Sample orders with discount fields:');
        possibleDiscounts.forEach(order => {
          console.log(`  Order ${order.id}: descuento_valor=${order.descuento_valor}, comentario="${order.descuento_comentario}", fecha=${order.descuento_aplicado_fecha}`);
        });
      }
      return;
    }

    console.log(`✅ Found ${allDiscounts.length} orders with discounts`);

    // 2. Show all discounts found
    console.log('\n📋 All discounts found:');
    allDiscounts.forEach((order, index) => {
      const appliedDate = order.descuento_aplicado_fecha ? new Date(order.descuento_aplicado_fecha).toLocaleString('es-CO') : 'No date';
      console.log(`  ${index + 1}. Order ${order.id} (${order.sedes?.name || 'No sede'})`);
      console.log(`     Discount: $${order.descuento_valor?.toLocaleString() || 0}`);
      console.log(`     Comment: "${order.descuento_comentario || 'No comment'}"`);
      console.log(`     Applied by: ${order.descuento_aplicado_por || 'Unknown'}`);
      console.log(`     Date: ${appliedDate}`);
      console.log(`     Order date: ${new Date(order.created_at).toLocaleString('es-CO')}`);
      console.log('');
    });

    // 3. Check for sede test specifically
    console.log('3️⃣ Checking discounts in sede test...');
    const testSedeDiscounts = allDiscounts.filter(order =>
      order.sedes?.name?.toLowerCase().includes('test')
    );

    if (testSedeDiscounts.length > 0) {
      console.log(`✅ Found ${testSedeDiscounts.length} discounts in test sede:`);
      testSedeDiscounts.forEach(order => {
        console.log(`  - Order ${order.id}: $${order.descuento_valor?.toLocaleString()}`);
      });
    } else {
      console.log('⚠️ No discounts found in test sede');
    }

    // 4. Test the date filtering that might be causing issues
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = yesterday.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    console.log(`\n4️⃣ Testing date filtering (${startDate} to ${endDate})...`);

    // Test current filtering method (problematic)
    const { data: filteredDiscounts, error: filterError } = await supabase
      .from('ordenes')
      .select('id, descuento_valor, descuento_aplicado_fecha')
      .not('descuento_valor', 'is', null)
      .gt('descuento_valor', 0)
      .gte('descuento_aplicado_fecha', startDate)
      .lte('descuento_aplicado_fecha', endDate);

    if (filterError) {
      console.error('❌ Error with date filtering:', filterError);
    } else {
      console.log(`📊 Filtered discounts (current method): ${filteredDiscounts?.length || 0}`);
    }

    // 5. Calculate metrics manually
    if (allDiscounts.length > 0) {
      console.log('\n5️⃣ Manual metrics calculation:');
      const totalDiscounts = allDiscounts.length;
      const totalAmount = allDiscounts.reduce((sum, order) => sum + (order.descuento_valor || 0), 0);
      const average = totalAmount / totalDiscounts;

      // Group by status
      const byStatus = {};
      allDiscounts.forEach(order => {
        const status = order.status || 'Unknown';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      console.log(`  Total discounts: ${totalDiscounts}`);
      console.log(`  Total amount: $${totalAmount.toLocaleString()}`);
      console.log(`  Average: $${Math.round(average).toLocaleString()}`);
      console.log('  By status:', byStatus);
    }

    console.log('\n✅ Discount metrics debug completed');

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugDiscountMetrics();