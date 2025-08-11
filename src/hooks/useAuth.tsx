import React, { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase, type Database } from '@/lib/supabase'
import { debugEnv } from '@/utils/debug'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextType {
  user: SupabaseUser | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 Intentando obtener perfil para usuario:', userId)
      
      // Crear un timeout para evitar que se quede colgado
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000)
      })
      
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

      if (error) {
        console.error('❌ Error fetching profile:', error)
        
        // Si hay error de RLS o timeout, crear un perfil temporal
        if (error.code === 'PGRST116' || error.message.includes('policy') || error.message.includes('Timeout')) {
          console.log('🔄 Creando perfil temporal...')
          
          // Determinar el rol basado en el email
          const userEmail = user?.email || '';
          let userRole: 'admin' | 'agent' = 'agent'; // Por defecto es agente
          
          if (userEmail.includes('admin') || userEmail.includes('carlos')) {
            userRole = 'admin';
          }
          
          // Crear un perfil temporal basado en el usuario autenticado
          const tempProfile: Profile = {
            id: userId,
            email: userEmail,
            name: user?.user_metadata?.name || userEmail || 'Usuario',
            role: userRole,
            sede_id: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          console.log('✅ Perfil temporal creado:', tempProfile)
          return tempProfile
        }
        
        return null
      }

      console.log('✅ Perfil obtenido:', data)
      return data
    } catch (error) {
      console.error('❌ Error fetching profile:', error)
      
      // Crear perfil temporal en caso de error
      console.log('🔄 Creando perfil temporal por error...')
      
      // Determinar el rol basado en el email
      const userEmail = user?.email || '';
      let userRole: 'admin' | 'agent' = 'agent'; // Por defecto es agente
      
      if (userEmail.includes('admin') || userEmail.includes('carlos')) {
        userRole = 'admin';
      }
      
      const tempProfile: Profile = {
        id: userId,
        email: userEmail,
        name: user?.user_metadata?.name || userEmail || 'Usuario',
        role: userRole,
        sede_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      console.log('✅ Perfil temporal creado:', tempProfile)
      return tempProfile
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  useEffect(() => {
    console.log('🚀 AuthProvider iniciando...')
    debugEnv()
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('📋 Sesión inicial:', session ? 'Presente' : 'Ausente')
      setUser(session?.user ?? null)
      if (session?.user) {
        console.log('👤 Usuario encontrado:', session.user.email)
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      } else {
        console.log('👤 No hay usuario en sesión')
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email)
      setUser(session?.user ?? null)
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Intentando iniciar sesión con:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Error de autenticación:', error.message)
        return { error: error.message }
      }

      console.log('✅ Autenticación exitosa')
      console.log('Usuario autenticado:', data.user.email)
      
      // Intentar obtener el perfil inmediatamente después del login
      if (data.user) {
        const profileData = await fetchProfile(data.user.id)
        setProfile(profileData)
      }
      
      return {}
    } catch (error) {
      console.error('❌ Error inesperado:', error)
      return { error: 'Error inesperado al iniciar sesión' }
    }
  }

  const signOut = async () => {
    console.log('🚪 Cerrando sesión...')
    await supabase.auth.signOut()
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}