// Script para debuggear las métricas del administrador

console.log('🔍 Debuggeando métricas del administrador...');

const testMetricsDebug = async () => {
  console.log('1. Verificando órdenes entregadas de hoy...');
  
  // Simulamos la query que hace el servicio
  const today = new Date().toISOString().split('T')[0];
  console.log('📅 Fecha de hoy:', today);
  
  console.log('\n2. Query que está ejecutando el servicio:');
  console.log(`
  SELECT 
    created_at,
    pagos.total_pago,
    sede_id
  FROM ordenes
  INNER JOIN pagos ON ordenes.payment_id = pagos.id
  WHERE 
    created_at >= '${today}T00:00:00'
    AND created_at <= '${today}T23:59:59'
    AND status = 'Entregados'
  `);
  
  console.log('\n3. Posibles problemas a verificar:');
  console.log('- ¿Las órdenes tienen payment_id asociado?');
  console.log('- ¿Los pagos tienen total_pago definido?');
  console.log('- ¿El estado es exactamente "Entregados" (con mayúscula)?');
  console.log('- ¿Las fechas están en el rango correcto?');
  
  console.log('\n4. Para verificar manualmente en Supabase:');
  console.log('a) Verificar órdenes del cliente:');
  console.log('   SELECT * FROM ordenes WHERE cliente_id = [ID_CLIENTE] ORDER BY created_at DESC;');
  
  console.log('\nb) Verificar pagos asociados:');
  console.log('   SELECT o.id, o.status, o.created_at, p.id as payment_id, p.total_pago, p.status as payment_status');
  console.log('   FROM ordenes o LEFT JOIN pagos p ON o.payment_id = p.id');
  console.log('   WHERE o.status = \'Entregados\' ORDER BY o.created_at DESC;');
  
  console.log('\nc) Verificar duplicados o problemas:');
  console.log('   SELECT cliente_id, COUNT(*) as cantidad');
  console.log('   FROM ordenes'); 
  console.log('   WHERE status = \'Entregados\' AND DATE(created_at) = CURRENT_DATE');
  console.log('   GROUP BY cliente_id HAVING COUNT(*) > 1;');
  
  console.log('\n5. Soluciones a implementar:');
  console.log('- Cambiar INNER JOIN por LEFT JOIN para incluir órdenes sin pago');
  console.log('- Agregar logs detallados en el servicio');
  console.log('- Verificar que no se estén agrupando incorrectamente');
  console.log('- Revisar filtros de fecha y sede');
};

testMetricsDebug();

console.log('\n📋 Pasos para debuggear:');
console.log('1. Abrir el AdminPanel');
console.log('2. Ir a la sección de métricas');
console.log('3. Verificar la consola del navegador para logs detallados');
console.log('4. Comparar con los datos reales en la base de datos');