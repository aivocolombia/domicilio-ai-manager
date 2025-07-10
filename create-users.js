// Script para crear usuarios mediante la API de Supabase
// Ejecutar con: node create-users.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de ambiente
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitas la service role key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan las variables de ambiente VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createUsers() {
  try {
    console.log('Creando usuarios...')

    // Crear usuario administrador
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email: 'admin@ajiaco.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        name: 'Administrador'
      }
    })

    if (adminError) {
      console.error('Error creando administrador:', adminError)
    } else {
      console.log('✅ Usuario administrador creado:', adminData.user.email)
    }

    // Crear usuario agente
    const { data: agentData, error: agentError } = await supabase.auth.admin.createUser({
      email: 'agente@ajiaco.com',
      password: 'agente123',
      email_confirm: true,
      user_metadata: {
        name: 'Agente'
      }
    })

    if (agentError) {
      console.error('Error creando agente:', agentError)
    } else {
      console.log('✅ Usuario agente creado:', agentData.user.email)
    }

    // Insertar perfiles en la tabla profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert([
        {
          id: adminData?.user?.id,
          email: 'admin@ajiaco.com',
          name: 'Administrador',
          role: 'admin'
        },
        {
          id: agentData?.user?.id,
          email: 'agente@ajiaco.com',
          name: 'Agente',
          role: 'agent'
        }
      ])

    if (profileError) {
      console.error('Error insertando perfiles:', profileError)
    } else {
      console.log('✅ Perfiles insertados correctamente')
    }

    console.log('\n🎉 Usuarios creados exitosamente!')
    console.log('Administrador: admin@ajiaco.com / admin123')
    console.log('Agente: agente@ajiaco.com / agente123')

  } catch (error) {
    console.error('Error general:', error)
  }
}

createUsers() 