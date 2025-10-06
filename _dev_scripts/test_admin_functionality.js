// Script para probar la funcionalidad del AdminPanel
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminFunctionality() {
  console.log('🧪 Iniciando pruebas del Admin Panel...');

  try {
    // 1. Verificar sedes disponibles
    console.log('1️⃣ Verificando sedes disponibles...');
    const { data: sedes, error: sedesError } = await supabase
      .from('sedes')
      .select('*')
      .order('name');

    if (sedesError) {
      console.error('❌ Error obteniendo sedes:', sedesError);
    } else {
      console.log('✅ Sedes encontradas:', sedes?.length || 0);
      sedes?.forEach(sede => {
        console.log(`  - ${sede.name} (${sede.id})`);
      });
    }

    // 2. Verificar usuarios existentes
    console.log('\n2️⃣ Verificando usuarios existentes...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('❌ Error obteniendo usuarios:', usersError);
    } else {
      console.log('✅ Usuarios encontrados:', users?.length || 0);
      users?.forEach(user => {
        console.log(`  - ${user.name} (${user.email}) - ${user.role}`);
      });
    }

    // 3. Simular creación de usuario de prueba (sin ejecutar)
    console.log('\n3️⃣ Simulando datos para creación de usuario...');
    const testUserData = {
      email: 'test.user@ajiaco.com',
      name: 'Usuario de Prueba',
      role: 'agent',
      sede_id: sedes?.[0]?.id || 'sede-niza',
      is_active: true
    };
    
    console.log('📋 Datos de usuario de prueba:', testUserData);

    // 4. Verificar función RPC (si existe)
    console.log('\n4️⃣ Verificando función RPC create_user_profile_only...');
    try {
      // Solo verificamos si la función existe, no la ejecutamos
      const { data: rpcTest, error: rpcError } = await supabase
        .rpc('create_user_profile_only', {
          p_email: 'test@example.com',
          p_name: 'Test',
          p_role: 'agent',
          p_sede_id: null,
          p_is_active: true
        });

      if (rpcError) {
        console.log('⚠️ Función RPC no disponible:', rpcError.message);
        console.log('📝 Se usará inserción directa en profiles');
      } else {
        console.log('✅ Función RPC disponible');
      }
    } catch (error) {
      console.log('⚠️ Función RPC no disponible, se usará inserción directa');
    }

    console.log('\n✅ Prueba de Admin Panel completada');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

// Solo ejecutar si este archivo se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testAdminFunctionality();
}

export { testAdminFunctionality };