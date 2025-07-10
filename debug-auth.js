// Script para diagnosticar problemas de autenticación
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Faltan las variables de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugAuth() {
  try {
    console.log('🔍 Diagnosticando autenticación...')
    console.log('URL:', supabaseUrl)
    console.log('Anon Key:', supabaseAnonKey.substring(0, 20) + '...')

    // 1. Verificar conexión básica
    console.log('\n1. Verificando conexión básica...')
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (testError) {
      console.log('❌ Error de conexión:', testError.message)
      console.log('💡 Esto indica que las políticas RLS no están configuradas')
    } else {
      console.log('✅ Conexión básica funcionando')
    }

    // 2. Intentar autenticación
    console.log('\n2. Probando autenticación...')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@ajiaco.com',
      password: 'admin123'
    })

    if (authError) {
      console.log('❌ Error de autenticación:', authError.message)
    } else {
      console.log('✅ Autenticación exitosa')
      console.log('Usuario ID:', authData.user.id)
      console.log('Email:', authData.user.email)

      // 3. Intentar obtener perfil
      console.log('\n3. Intentando obtener perfil...')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (profileError) {
        console.log('❌ Error obteniendo perfil:', profileError.message)
        console.log('💡 Esto indica que las políticas RLS están bloqueando el acceso')
      } else {
        console.log('✅ Perfil obtenido correctamente')
        console.log('Perfil:', profileData)
      }

      // 4. Cerrar sesión
      await supabase.auth.signOut()
      console.log('✅ Sesión cerrada')
    }

    // 5. Verificar políticas RLS
    console.log('\n4. Verificando políticas RLS...')
    console.log('💡 Si las políticas no están configuradas, necesitas ejecutar el script SQL')

  } catch (error) {
    console.error('Error general:', error)
  }
}

debugAuth() 