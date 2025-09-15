import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { customAuthService, type AuthUser } from '@/services/customAuthService'
import { logDebug, logError } from '@/utils/logger'

// Declarar función de emergencia en window para TypeScript
declare global {
  interface Window {
    emergencyLogout?: () => Promise<void>;
  }
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (nickname: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  // Funciones de utilidad para roles (mantener compatibilidad)
  profile: AuthUser | null // Alias para mantener compatibilidad
  canManageUsers: () => boolean
  canManageAllSedes: () => boolean
  canAccessAdminPanel: () => boolean
  getUserSedeId: () => string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Función para iniciar sesión
  const signIn = async (nickname: string, password: string) => {
    try {
      console.log('🔐 Intentando autenticar con nickname:', nickname)
      setLoading(true)
      
      const result = await customAuthService.signIn(nickname, password)
      
      if (result.error) {
        console.error('❌ Error de autenticación:', result.error)
        return { error: result.error }
      }

      if (result.user) {
        setUser(result.user)
        console.log('✅ Autenticación exitosa:', result.user.nickname, '-', result.user.role)
      }

      return {}
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      console.error('❌ Error inesperado en signIn:', error)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  // Función para cerrar sesión
  const signOut = async () => {
    try {
      console.log('🚪 Cerrando sesión...')
      await customAuthService.signOut()
      setUser(null)
      console.log('✅ Sesión cerrada exitosamente')
    } catch (error) {
      console.error('❌ Error inesperado en signOut:', error)
      setUser(null) // Limpiar estado local incluso en caso de error
    }
  }

  // Función para refrescar perfil (mantener compatibilidad)
  const refreshProfile = async () => {
    const currentUser = customAuthService.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      logDebug('AuthProvider', '✅ Perfil refrescado desde servicio de auth')
    }
  }

  // Funciones de utilidad para roles
  const canManageUsers = () => customAuthService.canManageUsers()
  const canManageAllSedes = () => customAuthService.canManageAllSedes()
  const canAccessAdminPanel = () => customAuthService.canAccessAdminPanel()
  const getUserSedeId = () => customAuthService.getUserSedeId()

  // Configurar función de emergencia
  useEffect(() => {
    window.emergencyLogout = async () => {
      console.log('🚨 Ejecutando logout de emergencia...')
      await signOut()
    }
    
    return () => {
      delete window.emergencyLogout
    }
  }, [])

  // Efecto para restaurar sesión al cargar
  useEffect(() => {
    const restoreSession = async () => {
      try {
        setLoading(true)
        console.log('🔄 Restaurando sesión...')
        
        const restoredUser = await customAuthService.restoreSession()
        if (restoredUser) {
          setUser(restoredUser)
          console.log('✅ Sesión restaurada:', restoredUser.nickname)
        } else {
          console.log('ℹ️ No hay sesión previa para restaurar')
        }
      } catch (error) {
        console.error('❌ Error restaurando sesión:', error)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  const value: AuthContextType = {
    user,
    profile: user, // Alias para mantener compatibilidad con código existente
    loading,
    signIn,
    signOut,
    refreshProfile,
    canManageUsers,
    canManageAllSedes,
    canAccessAdminPanel,
    getUserSedeId,
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