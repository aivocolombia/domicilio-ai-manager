import React, { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase, type Database } from '@/lib/supabase'

// Declarar función de emergencia en window para TypeScript
declare global {
  interface Window {
    emergencyLogout?: () => Promise<void>;
  }
}

type Profile = Database['public']['Tables']['profiles']['Row'] & {
  sede_name?: string; // Campo adicional para el nombre de la sede
}

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

  const enrichProfileWithSedeName = async (profile: Profile): Promise<Profile> => {
    try {
      if (!profile.sede_id) return profile;
      
      console.log('🏢 Obteniendo nombre de sede para ID:', profile.sede_id);
      const { data: sedeData, error } = await supabase
        .from('sedes')
        .select('name')
        .eq('id', profile.sede_id)
        .single();
      
      if (error) {
        console.error('❌ Error obteniendo nombre de sede:', error);
        return profile;
      }
      
      const enrichedProfile = {
        ...profile,
        sede_name: sedeData?.name || 'Sede Desconocida'
      };
      
      console.log('✅ Perfil enriquecido con nombre de sede:', enrichedProfile.sede_name);
      return enrichedProfile;
    } catch (error) {
      console.error('❌ Error enriching profile:', error);
      return profile;
    }
  };

  const createTempProfile = async (userId: string, userEmail: string, userData?: SupabaseUser): Promise<Profile> => {
    // Si ya tenemos un perfil válido, preservar sus datos
    if (profile) {
      console.log('📋 Perfil existente detectado, preservando datos actuales');
      return {
        ...profile,
        id: userId,
        email: userEmail
      };
    }
    
    let userRole: 'admin' | 'agent' = 'agent';
    let sedeId: string | null = null;
    
    // Detección más robusta del rol admin
    if (userEmail.includes('admin') || userEmail.includes('carlos') || userEmail === 'admin@ajiaco.com') {
      userRole = 'admin';
    }
    
    // PRIMERO: Intentar obtener el perfil real de la base de datos por si existe
    console.log('🔍 Intentando obtener perfil real de la base de datos antes de crear temporal...');
    try {
      const { data: realProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!profileError && realProfile) {
        console.log('✅ Perfil real encontrado en la base de datos:', realProfile);
        // Enriquecer con nombre de sede si tiene sede_id
        if (realProfile.sede_id) {
          const enrichedProfile = await enrichProfileWithSedeName(realProfile);
          return enrichedProfile;
        }
        return realProfile;
      }
    } catch (error) {
      console.log('ℹ️ No se encontró perfil real, continuando con temporal...');
    }
    
    // SEGUNDO: Si no existe perfil real, crear temporal con sede por defecto
    // Asignar sede_id por defecto basado en el email para usuarios conocidos
    if (userEmail === 'agente@ajiaco.com') {
      sedeId = '310368ae-1ab6-49bb-908b-8f95a77581f8'; // Sede que aparece en los logs
    } else if (userEmail === 'admin@ajiaco.com') {
      sedeId = '310368ae-1ab6-49bb-908b-8f95a77581f8'; // Misma sede por defecto
    } else {
      // Para cualquier otro usuario, asignar sede por defecto
      sedeId = '310368ae-1ab6-49bb-908b-8f95a77581f8';
    }
    
    console.log('🏢 Creando perfil temporal con sede por defecto:', { email: userEmail, sedeId, role: userRole });
    
    const tempProfile: Profile = {
      id: userId,
      email: userEmail,
      name: userData?.user_metadata?.name || userEmail || 'Usuario',
      role: userRole,
      sede_id: sedeId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Enriquecer con nombre de sede
    const enrichedProfile = await enrichProfileWithSedeName(tempProfile);
    return enrichedProfile;
  };

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 Intentando obtener perfil para usuario:', userId)
      
      // Verificar que hay un userId válido
      if (!userId) {
        console.log('⚠️ No se proporcionó userId, retornando null')
        return null
      }
      
      // Timeout más largo para conectividad lenta
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 20000) // 20 segundos
      })
      
      console.log('🔍 Intentando obtener perfil desde base de datos...')
      
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      const { data, error } = result;

      if (error) {
        console.error('❌ Error fetching profile:', error)
        
        // Solo crear perfil temporal si no encontramos el perfil y es un error específico de "no encontrado"
        if (error.code === 'PGRST116' || error.code === 'PGRST001') {
          console.log('🔄 Perfil no encontrado en base de datos, creando temporal...')
          const userEmail = user?.email || '';
          const tempProfile = await createTempProfile(userId, userEmail, user);
          console.log('✅ Perfil temporal creado:', tempProfile)
          return tempProfile
        }
        
        // Para otros errores, no crear perfil temporal automáticamente
        console.warn('⚠️ Error de conexión/timeout, manteniendo perfil actual:', error)
        return null
      }

      console.log('✅ Perfil obtenido desde base de datos:', data)
      
      // Si el perfil tiene sede_id, obtener el nombre de la sede
      if (data && data.sede_id) {
        const sedeProfile = await enrichProfileWithSedeName(data);
        return sedeProfile;
      }
      
      return data
    } catch (error: unknown) {
      console.error('❌ Error fetching profile:', error)
      
      // Solo crear perfil temporal si es un error específico de "perfil no encontrado"
      if (error instanceof Error && (
        error.message.includes('not found') || 
        error.message.includes('PGRST116') ||
        error.message.includes('Row not found')
      )) {
        console.log('🔄 Perfil no encontrado (catch), creando temporal...')
        const userEmail = user?.email || '';
        const tempProfile = await createTempProfile(userId, userEmail, user);
        console.log('✅ Perfil temporal creado:', tempProfile)
        return tempProfile
      }
      
      // Para errores de timeout/red, retornar null en lugar de crear perfil temporal
      console.warn('⚠️ Error de conexión/timeout, no creando perfil temporal:', error)
      
      if (error instanceof Error && error.message === 'Timeout') {
        // Crear función de emergencia para logout global
        window.emergencyLogout = async () => {
          try {
            console.log('🚨 LOGOUT DE EMERGENCIA ACTIVADO')
            await supabase.auth.signOut()
            localStorage.clear()
            sessionStorage.clear()
            window.location.href = '/'
          } catch (e) {
            console.error('Error en logout de emergencia:', e)
            window.location.href = '/'
          }
        }
        console.error('🚨 Para logout de emergencia desde consola, ejecuta: window.emergencyLogout()')
      }
      
      return null
    }
  }

  const refreshProfile = async () => {
    if (user?.id) {
      try {
        console.log('🔄 Refrescando perfil de usuario...')
        const profileData = await fetchProfile(user.id)
        setProfile(profileData)
        console.log('✅ Perfil refrescado exitosamente')
      } catch (error) {
        console.error('❌ Error refrescando perfil:', error)
        // No establecer profile como null aquí para mantener el estado actual
      }
    } else {
      console.log('⚠️ No hay usuario para refrescar perfil')
    }
  }

  useEffect(() => {
    console.log('🚀 AuthProvider iniciando...')
    
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
      
      // Si es un evento de sign out, limpiar estado inmediatamente
      if (event === 'SIGNED_OUT') {
        console.log('👋 Usuario cerró sesión, limpiando estado...')
        setUser(null)
        setProfile(null)
        setLoading(false)
        // Limpiar localStorage de vista activa
        localStorage.removeItem('ajiaco-active-tab')
        localStorage.removeItem('ajiaco-admin-active-tab')
        console.log('🧹 Vistas activas limpiadas del localStorage (SIGNED_OUT)')
        return
      }
      
      setUser(session?.user ?? null)
      if (session?.user && event !== 'SIGNED_OUT') {
        try {
          const profileData = await fetchProfile(session.user.id)
          // Solo actualizar perfil si obtenemos datos válidos
          if (profileData) {
            setProfile(profileData)
          }
          // Si profileData es null pero ya tenemos un perfil, mantenerlo
        } catch (error) {
          console.error('❌ Error obteniendo perfil en auth change:', error)
          // No sobrescribir el perfil existente en caso de error temporal
        }
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
    try {
      console.log('🚪 Cerrando sesión...')
      setLoading(true)
      
      // Limpiar estado inmediatamente para evitar llamadas adicionales
      setProfile(null)
      
      // Limpiar localStorage de vista activa y navegación (SEGURIDAD CRÍTICA)
      localStorage.removeItem('ajiaco-active-tab')
      localStorage.removeItem('ajiaco-admin-active-tab')
      localStorage.removeItem('ajiaco-app-view')  // Limpiar vista guardada del useAppState
      localStorage.removeItem('ajiaco-navigation-history')  // Limpiar historial de navegación
      console.log('🧹 Vistas activas y navegación limpiadas del localStorage')
      
      // Cerrar sesión en Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Error cerrando sesión:', error)
        // Aún así limpiamos el estado local
      }
      
      console.log('✅ Sesión cerrada exitosamente')
    } catch (error) {
      console.error('❌ Error durante signOut:', error)
      // Forzar limpieza del estado incluso si hay error
      setProfile(null)
    } finally {
      setLoading(false)
    }
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