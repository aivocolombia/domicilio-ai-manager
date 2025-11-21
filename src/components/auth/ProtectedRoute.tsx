import { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions, UserRole } from '@/hooks/usePermissions'
import { Login } from '@/components/auth/Login'
import { Loader2 } from 'lucide-react'
import { logDebug, logWarn, logError } from '@/utils/logger'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const { userRole, permissions } = usePermissions()

  logDebug('ProtectedRoute', 'Renderizando ruta protegida', {
    user: user?.nickname,
    profile: profile?.display_name,
    userRole,
    loading,
    requiredRole
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  // Si no hay usuario autenticado con el nuevo sistema, mostrar login
  if (!user) {
    logWarn('ProtectedRoute', 'Usuario no autenticado, mostrando login')
    return <Login />
  }
  
  // Verificar si el usuario está activo
  if (!user.is_active) {
    logWarn('ProtectedRoute', 'Usuario inactivo', { userId: user.id })
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

  if (requiredRole && userRole !== requiredRole) {
    logWarn('ProtectedRoute', 'Acceso denegado por rol', { 
      userRole, 
      requiredRole, 
      userId: user.id 
    })
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

  logDebug('ProtectedRoute', 'Usuario autorizado', { userRole, userId: user.id })
  return <>{children}</>
}