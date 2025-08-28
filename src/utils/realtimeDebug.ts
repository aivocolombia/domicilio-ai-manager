import { supabase } from '@/lib/supabase';

export class RealtimeDebugHelper {
  
  static async checkSupabaseRealtimeConfig() {
    console.log('🔍 === DIAGNÓSTICO SUPABASE REALTIME ===');
    
    // 1. Verificar configuración básica
    console.log('1. Configuración básica:');
    console.log('   - Supabase URL:', supabase.supabaseUrl);
    console.log('   - Supabase inicializado:', !!supabase);
    
    // 2. Verificar conexión a la base de datos
    try {
      const { data, error } = await supabase.from('ordenes').select('id').limit(1);
      if (error) {
        console.error('   ❌ Error conectando a BD:', error.message);
      } else {
        console.log('   ✅ Conexión a BD exitosa');
      }
    } catch (error) {
      console.error('   ❌ Error de conexión:', error);
    }
    
    // 3. Verificar políticas RLS
    console.log('2. Verificando políticas RLS:');
    try {
      const { data, error } = await supabase
        .from('ordenes')
        .select('id, status, sede_id')
        .limit(5);
        
      if (error) {
        console.error('   ❌ RLS bloqueando consultas:', error.message);
      } else {
        console.log('   ✅ RLS permite consultas, registros encontrados:', data?.length || 0);
      }
    } catch (error) {
      console.error('   ❌ Error verificando RLS:', error);
    }
    
    // 4. Testear suscripción básica
    console.log('3. Testeando suscripción realtime:');
    return this.testRealtimeSubscription();
  }
  
  static async testRealtimeSubscription(): Promise<boolean> {
    return new Promise((resolve) => {
      let subscribed = false;
      let hasError = false;
      
      const testChannel = supabase
        .channel('test_connection')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ordenes'
          },
          (payload) => {
            console.log('   📡 Evento realtime recibido:', payload.eventType);
          }
        )
        .subscribe((status) => {
          console.log('   📡 Estado suscripción test:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('   ✅ Realtime funcionando correctamente');
            subscribed = true;
            
            // Cerrar canal de prueba después de un momento
            setTimeout(() => {
              supabase.removeChannel(testChannel);
              console.log('   🔌 Canal de prueba cerrado');
              resolve(true);
            }, 2000);
            
          } else if (status === 'CHANNEL_ERROR') {
            console.error('   ❌ Error en canal realtime');
            console.error('   Posibles causas:');
            console.error('     - Realtime no habilitado en proyecto Supabase');
            console.error('     - RLS bloqueando suscripciones');
            console.error('     - Límites de conexiones excedidos');
            hasError = true;
            
            supabase.removeChannel(testChannel);
            resolve(false);
          }
        });
      
      // Timeout después de 5 segundos
      setTimeout(() => {
        if (!subscribed && !hasError) {
          console.error('   ⏱️ Timeout esperando suscripción realtime');
          console.error('   Verifica que Supabase Realtime esté habilitado');
          supabase.removeChannel(testChannel);
          resolve(false);
        }
      }, 5000);
    });
  }
  
  static async checkTablePermissions(tableName: string = 'ordenes') {
    console.log(`4. Verificando permisos para tabla '${tableName}':`);
    
    try {
      // Test INSERT
      const testData = {
        sede_id: 'test',
        status: 'test',
        // Solo campos mínimos para evitar errores de FK
      };
      
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(testData)
        .select()
        .limit(0); // No ejecutar realmente
        
      console.log('   - INSERT permission:', insertError ? '❌' : '✅');
      
    } catch (error) {
      console.log('   - INSERT permission: ❌ (Error:', (error as Error).message, ')');
    }
  }
  
  static logRealtimeConfig() {
    console.log('🔍 === CONFIGURACIÓN REALTIME ACTUAL ===');
    
    // Verificar si la URL incluye realtime
    const isRealtimeEnabled = supabase.supabaseUrl.includes('supabase');
    console.log('Realtime probablemente habilitado:', isRealtimeEnabled ? '✅' : '❌');
    
    // Verificar configuración del cliente
    console.log('Cliente Supabase configurado:', !!supabase ? '✅' : '❌');
    
    // Mostrar recomendaciones
    console.log('\n📋 === RECOMENDACIONES ===');
    console.log('1. Verificar en Supabase Dashboard > Settings > API:');
    console.log('   - Realtime está habilitado');
    console.log('   - URL correcta:', supabase.supabaseUrl);
    
    console.log('2. Verificar RLS políticas permiten SELECT en tabla ordenes');
    console.log('3. Verificar que las políticas no bloqueen suscripciones');
    
    console.log('\n🎯 Para habilitar Realtime:');
    console.log('ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE ordenes;');
  }
}

// Función de utilidad para ejecutar todos los diagnósticos
export const runRealtimeFullDiagnosis = async () => {
  console.clear();
  RealtimeDebugHelper.logRealtimeConfig();
  return await RealtimeDebugHelper.checkSupabaseRealtimeConfig();
};