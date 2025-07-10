// Script para deshabilitar RLS temporalmente
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function disableRLS() {
  try {
    console.log('🔧 Deshabilitando RLS temporalmente...')
    
    // Deshabilitar RLS
    const { error: profilesError } = await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;' 
    })
    
    const { error: sedesError } = await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE sedes DISABLE ROW LEVEL SECURITY;' 
    })
    
    if (profilesError) {
      console.log('❌ Error deshabilitando RLS en profiles:', profilesError.message)
    }
    
    if (sedesError) {
      console.log('❌ Error deshabilitando RLS en sedes:', sedesError.message)
    }
    
    if (!profilesError && !sedesError) {
      console.log('✅ RLS deshabilitado temporalmente')
      console.log('💡 Ahora intenta hacer login nuevamente')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

disableRLS() 