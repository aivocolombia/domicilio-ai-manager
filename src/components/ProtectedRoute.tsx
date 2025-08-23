import { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Login } from '@/components/Login'
import { AdminPanel } from '@/components/AdminPanel'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'admin' | 'agent'
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  console.log('🛡️ ProtectedRoute renderizando:', {
    user: user?.email,
    profile: profile?.name,
    loading,
    requiredRole
  })

  if (loading) {
    console.log('⏳ Mostrando pantalla de carga...')
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    console.log('❌ No hay usuario o perfil, mostrando Login')
    return <Login />
  }

  if (!profile.is_active) {
    console.log('⚠️ Usuario inactivo, mostrando pantalla de cuenta desactivada')
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-destructive text-2xl">⚠</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cuenta Desactivada</h1>
          <p className="text-muted-foreground">
            Tu cuenta ha sido desactivada. Contacta al administrador para más información.
          </p>
        </div>
      </div>
    )
  }

  if (requiredRole && profile.role !== requiredRole) {
    console.log('🚫 Acceso denegado por rol:', profile.role, '!=', requiredRole)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-destructive text-2xl">🚫</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Acceso Denegado</h1>
          <p className="text-muted-foreground">
            No tienes permisos para acceder a esta sección del sistema.
          </p>
        </div>
      </div>
    )
  }

  // Show the main app for both admin and agent users
  // Admin users can navigate to AdminPanel through the UI
  console.log('👤 Usuario autenticado, mostrando aplicación principal')
  return <>{children}</>
}