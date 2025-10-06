const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPagos() {
  console.log('🔍 Debugging estructura de pagos...\n');

  try {
    // 1. Ver estructura de tabla pagos
    console.log('1️⃣ Verificando estructura de tabla pagos...');
    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('*')
      .limit(5);

    if (pagosError) {
      console.error('❌ Error obteniendo pagos:', pagosError);
    } else {
      console.log('📋 Estructura de pagos (primeros 5 registros):');
      pagos?.forEach((pago, index) => {
        console.log(`  ${index + 1}. ID: ${pago.id}`);
        console.log(`     orden_id: ${pago.orden_id}`);
        console.log(`     total_pago: ${pago.total_pago}`);
        console.log(`     Otros campos:`, Object.keys(pago).filter(k => !['id', 'orden_id', 'total_pago'].includes(k)));
        console.log('');
      });
    }

    // 2. Verificar si hay pagos con valores
    console.log('2️⃣ Verificando pagos con valores...');
    const { data: pagosConValor, error: valorError } = await supabase
      .from('pagos')
      .select('id, orden_id, total_pago')
      .gt('total_pago', 0)
      .limit(10);

    if (valorError) {
      console.error('❌ Error obteniendo pagos con valor:', valorError);
    } else {
      console.log('💰 Pagos con valor > 0:');
      if (pagosConValor && pagosConValor.length > 0) {
        pagosConValor.forEach(pago => {
          console.log(`  - Orden ${pago.orden_id}: $${pago.total_pago}`);
        });
      } else {
        console.log('  ⚠️ No se encontraron pagos con valor > 0');
      }
    }

    // 3. Ver algunas órdenes con sus pagos
    console.log('\n3️⃣ Verificando órdenes recientes con pagos...');
    const { data: ordenes, error: ordenesError } = await supabase
      .from('ordenes')
      .select('id, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordenesError) {
      console.error('❌ Error obteniendo órdenes:', ordenesError);
    } else {
      console.log('📋 Órdenes recientes:');
      for (const orden of ordenes || []) {
        // Buscar pagos para esta orden
        const { data: pagosOrden, error: pagosOrdenError } = await supabase
          .from('pagos')
          .select('*')
          .eq('orden_id', orden.id);

        console.log(`  - Orden ${orden.id} (${orden.status})`);
        if (pagosOrdenError) {
          console.log(`    ❌ Error obteniendo pagos: ${pagosOrdenError.message}`);
        } else if (pagosOrden && pagosOrden.length > 0) {
          pagosOrden.forEach(pago => {
            console.log(`    💰 Pago: $${pago.total_pago || 0} (ID: ${pago.id})`);
          });
        } else {
          console.log(`    ⚠️ Sin pagos registrados`);
        }
      }
    }

    // 4. Verificar campos alternativos en pagos
    console.log('\n4️⃣ Verificando campos alternativos en pagos...');
    const { data: primerPago, error: primerPagoError } = await supabase
      .from('pagos')
      .select('*')
      .limit(1)
      .single();

    if (primerPagoError) {
      console.error('❌ Error obteniendo primer pago:', primerPagoError);
    } else {
      console.log('🔍 Campos disponibles en tabla pagos:');
      Object.keys(primerPago || {}).forEach(key => {
        const value = primerPago[key];
        console.log(`  - ${key}: ${value} (${typeof value})`);
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

debugPagos();