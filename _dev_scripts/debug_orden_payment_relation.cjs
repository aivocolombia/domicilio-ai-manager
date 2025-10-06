const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2MDY1OSwiZXhwIjoyMDY3NzM2NjU5fQ.xH4bY8_TUD5TwwjPRfs7GgZH6RHOmOFa54tbT65Noio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOrdenPaymentRelation() {
  console.log('🔍 Debugging relación entre órdenes y pagos...\n');

  try {
    // 1. Verificar si existe tabla orden_pagos o similar
    console.log('1️⃣ Verificando posibles tablas de relación...');

    const tablesToCheck = [
      'orden_pagos',
      'ordenes_pagos',
      'payment_orders',
      'order_payments'
    ];

    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (!error) {
          console.log(`✅ Tabla encontrada: ${tableName}`);
          if (data && data.length > 0) {
            console.log('   Campos:', Object.keys(data[0]));
          }
        }
      } catch (err) {
        // Tabla no existe, continuar
      }
    }

    // 2. Verificar si órdenes tiene campo pago_id
    console.log('\n2️⃣ Verificando estructura de tabla órdenes...');
    const { data: orden, error: ordenError } = await supabase
      .from('ordenes')
      .select('*')
      .limit(1)
      .single();

    if (ordenError) {
      console.error('❌ Error obteniendo orden:', ordenError);
    } else {
      console.log('🔍 Campos en tabla órdenes:');
      Object.keys(orden || {}).forEach(key => {
        const value = orden[key];
        console.log(`  - ${key}: ${value} (${typeof value})`);
      });

      // Buscar campos relacionados con pagos
      const paymentFields = Object.keys(orden || {}).filter(key =>
        key.toLowerCase().includes('pago') ||
        key.toLowerCase().includes('payment') ||
        key.toLowerCase().includes('total')
      );

      if (paymentFields.length > 0) {
        console.log('\n💰 Campos relacionados con pagos encontrados:');
        paymentFields.forEach(field => {
          console.log(`  - ${field}: ${orden[field]}`);
        });
      }
    }

    // 3. Verificar si hay alguna forma de calcular totales desde ordenes_platos y ordenes_bebidas
    console.log('\n3️⃣ Verificando cálculo de totales desde items de orden...');

    // Tomar una orden reciente
    const { data: recentOrder, error: recentError } = await supabase
      .from('ordenes')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentError && recentOrder) {
      console.log(`📋 Calculando total para orden ${recentOrder.id}:`);

      // Obtener platos
      const { data: platos, error: platosError } = await supabase
        .from('ordenes_platos')
        .select('cantidad, precio_unitario, precio_total')
        .eq('orden_id', recentOrder.id);

      if (!platosError && platos) {
        const totalPlatos = platos.reduce((sum, item) => sum + (item.precio_total || 0), 0);
        console.log(`  💰 Total platos: $${totalPlatos} (${platos.length} items)`);
      }

      // Obtener bebidas
      const { data: bebidas, error: bebidasError } = await supabase
        .from('ordenes_bebidas')
        .select('cantidad, precio_unitario, precio_total')
        .eq('orden_id', recentOrder.id);

      if (!bebidasError && bebidas) {
        const totalBebidas = bebidas.reduce((sum, item) => sum + (item.precio_total || 0), 0);
        console.log(`  🥤 Total bebidas: $${totalBebidas} (${bebidas.length} items)`);
      }

      // Verificar si la orden tiene total_amount
      const { data: orderWithTotal, error: totalError } = await supabase
        .from('ordenes')
        .select('total_amount, total, precio_total')
        .eq('id', recentOrder.id)
        .single();

      if (!totalError && orderWithTotal) {
        console.log('  📊 Totales en orden:');
        ['total_amount', 'total', 'precio_total'].forEach(field => {
          if (orderWithTotal[field] !== undefined) {
            console.log(`    - ${field}: $${orderWithTotal[field]}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

debugOrdenPaymentRelation();