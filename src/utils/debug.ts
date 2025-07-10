// Utilidad para debuggear variables de ambiente en el frontend
export function debugEnv() {
  console.log('🔍 Debugging environment variables...')
  console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
  console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Presente' : 'Ausente')
  
  // Verificar si las variables están definidas
  if (!import.meta.env.VITE_SUPABASE_URL) {
    console.error('❌ VITE_SUPABASE_URL no está definida')
  }
  
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY no está definida')
  }
  
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.log('✅ Todas las variables de ambiente están presentes')
  }
}

// Función para verificar la conexión de Supabase
export async function testSupabaseConnection() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Variables de ambiente faltantes')
      return false
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Probar conexión básica
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Error de conexión:', error.message)
      return false
    }
    
    console.log('✅ Conexión a Supabase exitosa')
    return true
  } catch (error) {
    console.error('❌ Error general:', error)
    return false
  }
} 