// Script para verificar y configurar la base de datos
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan las variables de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  try {
    console.log('🔍 Verificando estructura de la base de datos...')

    // Verificar si las tablas existen
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['profiles', 'sedes'])

    if (tablesError) {
      console.error('Error verificando tablas:', tablesError)
      return
    }

    const existingTables = tables.map(t => t.table_name)
    console.log('Tablas existentes:', existingTables)

    if (existingTables.length < 2) {
      console.log('⚠️  Faltan tablas. Ejecutando script de configuración...')
      
      // Leer y ejecutar el script SQL
      const sqlScript = fs.readFileSync('./database-setup.sql', 'utf8')
      
      // Dividir el script en comandos individuales
      const commands = sqlScript
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))

      for (const command of commands) {
        if (command.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql: command })
          if (error) {
            console.log('Comando ejecutado:', command.substring(0, 50) + '...')
          }
        }
      }
      
      console.log('✅ Script de base de datos ejecutado')
    } else {
      console.log('✅ Las tablas ya existen')
    }

    // Verificar usuarios
    console.log('\n🔍 Verificando usuarios...')
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('email', ['admin@ajiaco.com', 'agente@ajiaco.com'])

    if (profilesError) {
      console.error('Error verificando perfiles:', profilesError)
    } else {
      console.log('Usuarios encontrados:', profiles.length)
      profiles.forEach(p => {
        console.log(`- ${p.email} (${p.role})`)
      })
    }

    // Verificar políticas RLS
    console.log('\n🔍 Verificando políticas de seguridad...')
    const { data: policies, error: policiesError } = await supabase
      .from('information_schema.policies')
      .select('*')
      .eq('table_schema', 'public')
      .in('table_name', ['profiles', 'sedes'])

    if (policiesError) {
      console.error('Error verificando políticas:', policiesError)
    } else {
      console.log('Políticas encontradas:', policies.length)
    }

    console.log('\n🎉 Verificación completada!')
    console.log('Ahora puedes intentar hacer login con:')
    console.log('- admin@ajiaco.com / admin123')
    console.log('- agente@ajiaco.com / agente123')

  } catch (error) {
    console.error('Error general:', error)
  }
}

setupDatabase() 