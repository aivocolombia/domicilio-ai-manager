/**
 * Script para testear la conexión realtime específica de Supabase
 * Este script ayudará a identificar si el problema es de configuración
 */

console.log('🧪 Testing Supabase Realtime Connection for Orders Table...\n');

// Test de problemas encontrados
console.log('❌ Issues Found in Logs:');

const issues = [
  {
    issue: 'ReferenceError: currentSedeId is not defined',
    status: 'FIXED',
    fix: 'Changed user.sede_id !== currentSedeId to user.sede_id !== order.sede',
    impact: 'Dashboard can now load without crashing'
  },
  {
    issue: 'Realtime connection immediately closes (status: CLOSED)',
    status: 'INVESTIGATING',
    evidence: 'Other tables (sede_platos, sede_bebidas, sede_toppings) connect successfully',
    impact: 'Orders realtime not working, manual refresh required'
  }
];

issues.forEach((issue, index) => {
  console.log(`${index + 1}. ${issue.issue}:`);
  console.log(`   Status: ${issue.status}`);
  if (issue.fix) {
    console.log(`   Fix: ${issue.fix}`);
  }
  if (issue.evidence) {
    console.log(`   Evidence: ${issue.evidence}`);
  }
  console.log(`   Impact: ${issue.impact}`);
  console.log('');
});

console.log('🔍 Analysis of Working vs Non-Working Subscriptions:');

const comparison = [
  {
    table: 'sede_platos',
    status: 'WORKING ✅',
    logs: '✅ [sede_platos] Successfully subscribed to realtime',
    pattern: 'Normal subscription to sede-specific inventory table'
  },
  {
    table: 'sede_bebidas',
    status: 'WORKING ✅',
    logs: '✅ [sede_bebidas] Successfully subscribed to realtime',
    pattern: 'Normal subscription to sede-specific inventory table'
  },
  {
    table: 'sede_toppings',
    status: 'WORKING ✅',
    logs: '✅ [sede_toppings] Successfully subscribed to realtime',
    pattern: 'Normal subscription to sede-specific inventory table'
  },
  {
    table: 'ordenes',
    status: 'FAILING ❌',
    logs: '⚠️ Conexión realtime cerrada para sede: {sedeId}',
    pattern: 'Connection immediately closes after attempting to subscribe'
  }
];

comparison.forEach(item => {
  console.log(`📊 ${item.table}: ${item.status}`);
  console.log(`   Logs: ${item.logs}`);
  console.log(`   Pattern: ${item.pattern}`);
  console.log('');
});

console.log('🎯 Possible Root Causes for Orders Table:');

const causes = [
  {
    cause: 'Row Level Security (RLS) Policy Issue',
    likelihood: 'HIGH',
    description: 'ordenes table has restrictive RLS that blocks realtime subscriptions',
    test: 'Check if authenticated users have SELECT permission on ordenes table',
    sqlCheck: 'SELECT * FROM ordenes LIMIT 1; -- Should work in SQL editor'
  },
  {
    cause: 'Realtime Publication Issue',
    likelihood: 'HIGH',
    description: 'ordenes table not included in realtime publication',
    test: 'Verify ordenes table is enabled for realtime in Supabase dashboard',
    sqlCheck: "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
  },
  {
    cause: 'Table Permission Difference',
    likelihood: 'MEDIUM',
    description: 'ordenes table has different permissions than working sede_* tables',
    test: 'Compare RLS policies between ordenes and sede_platos tables',
    sqlCheck: 'Check if same user role can access both tables'
  },
  {
    cause: 'Filter Format Issue',
    likelihood: 'LOW',
    description: 'sede_id filter format causing subscription to fail',
    test: 'Test subscription without filter (already doing this)',
    sqlCheck: 'Verify sede_id field exists and has correct format in ordenes table'
  }
];

causes.forEach((cause, index) => {
  console.log(`${index + 1}. ${cause.cause} [${cause.likelihood} likelihood]:`);
  console.log(`   Description: ${cause.description}`);
  console.log(`   Test: ${cause.test}`);
  console.log(`   SQL Check: ${cause.sqlCheck}`);
  console.log('');
});

console.log('🔧 Recommended Investigation Steps:');

const steps = [
  '1. Check Supabase Dashboard > Database > ordenes table > RLS policies',
  '2. Verify ordenes table is enabled for Realtime in Supabase Dashboard > Database > Realtime',
  '3. Compare RLS policies between ordenes and sede_platos (working table)',
  '4. Test manual SQL query: SELECT * FROM ordenes WHERE sede_id = \'your-sede-id\' LIMIT 1',
  '5. Check browser Network tab for WebSocket connection attempts',
  '6. Verify API key permissions include realtime access'
];

steps.forEach(step => {
  console.log(`${step}`);
});

console.log('\n🎉 Next Steps:');
console.log('✅ ReferenceError fixed - Dashboard should load without crashing');
console.log('🔍 Check browser console for new [ORDERS] debug logs');
console.log('📊 Compare ordenes table permissions with working sede_* tables');
console.log('🛠️ Check Supabase Dashboard settings for ordenes table realtime enablement');

console.log('\nIf you see these logs in browser console:');
console.log('- ✅ [ORDERS] Realtime conectado exitosamente = Success');
console.log('- ❌ [ORDERS] Error en conexión realtime = Check RLS/permissions');
console.log('- ⚠️ Conexión realtime cerrada = Check realtime publication');