/**
 * Script de debug para probar la lógica de timezone
 * Ejecutar con: node test_timezone_debug.js
 */

// Simular la función getStartOfDayInColombia
function getStartOfDayInColombia(date = new Date()) {
  const colombiaOffset = -5 * 60; // -300 minutos
  const colombiaDate = new Date(date.getTime() + (colombiaOffset - date.getTimezoneOffset()) * 60000);
  colombiaDate.setHours(0, 0, 0, 0);
  return colombiaDate;
}

// Simular la función getEndOfDayInColombia
function getEndOfDayInColombia(date = new Date()) {
  const colombiaOffset = -5 * 60;
  const colombiaDate = new Date(date.getTime() + (colombiaOffset - date.getTimezoneOffset()) * 60000);
  colombiaDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(colombiaDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

console.log('========================================');
console.log('TEST DE TIMEZONE - DEBUG');
console.log('========================================\n');

// Simular "hoy" en Colombia
const now = new Date(); // Fecha actual del sistema
console.log('1. Fecha del sistema:', now.toISOString());
console.log('   Offset del sistema (min):', now.getTimezoneOffset());
console.log('   Zona esperada: UTC' + (now.getTimezoneOffset() > 0 ? '-' : '+') + Math.abs(now.getTimezoneOffset() / 60));

// Calcular inicio y fin del día
const startOfDay = getStartOfDayInColombia(now);
const endOfDay = getEndOfDayInColombia(now);

console.log('\n2. Rango calculado para HOY en Colombia:');
console.log('   Start:', startOfDay.toISOString());
console.log('   End:  ', endOfDay.toISOString());

// Simular órdenes de ejemplo en diferentes momentos del día
const testOrders = [
  { id: 1, created_at: '2025-12-13T06:00:00.000Z', desc: '1am Colombia (día 13)' },
  { id: 2, created_at: '2025-12-13T12:00:00.000Z', desc: '7am Colombia (día 13)' },
  { id: 3, created_at: '2025-12-13T18:00:00.000Z', desc: '1pm Colombia (día 13)' },
  { id: 4, created_at: '2025-12-14T03:00:00.000Z', desc: '10pm Colombia (día 13)' },
  { id: 5, created_at: '2025-12-14T04:59:59.999Z', desc: '11:59:59pm Colombia (día 13)' },
  { id: 6, created_at: '2025-12-14T05:00:00.000Z', desc: '12am Colombia (día 14 - NUEVO DÍA)' },
];

console.log('\n3. Prueba de filtrado de órdenes:');
console.log('   Usando: orderDate >= startOfDay && orderDate < endOfDay\n');

testOrders.forEach(order => {
  const orderDate = new Date(order.created_at);
  const isInRange = orderDate >= startOfDay && orderDate < endOfDay;

  console.log(`   Orden ${order.id}: ${order.desc}`);
  console.log(`      Fecha: ${orderDate.toISOString()}`);
  console.log(`      ¿En rango? ${isInRange ? '✅ SÍ' : '❌ NO'}`);
  console.log('');
});

console.log('========================================');
console.log('ANÁLISIS DEL PROBLEMA');
console.log('========================================\n');

// El problema real
console.log('HIPÓTESIS 1: Las órdenes en la BD tienen timestamps en UTC');
console.log('Si la orden se creó a las 10am Colombia (UTC-5):');
console.log('  - En la BD se guarda como: 15:00:00 UTC (10am + 5 horas)');
console.log('  - Nuestro filtro busca: 05:00:00 UTC a 05:00:00 UTC del día siguiente');
console.log('  - ¿La orden 15:00:00 UTC está en ese rango? SÍ ✅\n');

console.log('HIPÓTESIS 2: El problema está en cómo se interpreta "hoy"');
console.log('Si el navegador está en zona diferente a Colombia:');
const browserDate = new Date('2025-12-13T20:00:00'); // 8pm hora local
const colombiaStart = getStartOfDayInColombia(browserDate);
const colombiaEnd = getEndOfDayInColombia(browserDate);
console.log('  - Navegador (local): 8pm del día 13');
console.log('  - Colombia start:   ', colombiaStart.toISOString());
console.log('  - Colombia end:     ', colombiaEnd.toISOString());
console.log('  - ¿Está buscando el día correcto? Verificar...\n');

console.log('PRÓXIMO PASO: Revisar los logs de la consola del navegador');
console.log('Buscar el log que dice: "🕐 [DEBUG] Rango de fechas para repartidor"');
console.log('Y comparar con las fechas created_at de las órdenes en la BD\n');
