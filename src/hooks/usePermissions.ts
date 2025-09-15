import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Definición de roles del sistema
export type UserRole = 'admin' | 'administrador_punto' | 'agent';

// Definición de permisos específicos
export interface Permissions {
  // Gestión de sedes
  canViewAllSedes: boolean;
  canCreateSede: boolean;
  canEditSede: boolean;
  canDeleteSede: boolean;
  
  // Gestión de usuarios
  canCreateUser: boolean;
  canEditUserRole: boolean;
  canDeleteUser: boolean;
  canAssignUserToOtherSede: boolean;
  
  // Gestión de repartidores
  canCreateRepartidor: boolean;
  canEditRepartidor: boolean;
  canDeleteRepartidor: boolean;
  canAssignRepartidorToOtherSede: boolean;
  
  // Gestión de productos
  canCreateProduct: boolean;
  canEditProduct: boolean;
  canDeleteProduct: boolean;
  canCreateTopping: boolean;
  canEditTopping: boolean;
  canDeleteTopping: boolean;
  
  // Dashboard y órdenes
  canViewAllOrders: boolean;
  canCancelOrder: boolean;
  canTransferOrder: boolean;
  
  // Métricas y reportes
  canViewMetrics: boolean;
  canViewAllSedesMetrics: boolean;
  
  // Configuraciones
  canViewConfigurations: boolean;
  canEditConfigurations: boolean;
}

// Configuración de permisos por rol
const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  admin: {
    // El administrador tiene acceso completo a todo
    canViewAllSedes: true,
    canCreateSede: true,
    canEditSede: true,
    canDeleteSede: true,
    canCreateUser: true,
    canEditUserRole: true,
    canDeleteUser: true,
    canAssignUserToOtherSede: true,
    canCreateRepartidor: true,
    canEditRepartidor: true,
    canDeleteRepartidor: true,
    canAssignRepartidorToOtherSede: true,
    canCreateProduct: true,
    canEditProduct: true,
    canDeleteProduct: true,
    canCreateTopping: true,
    canEditTopping: true,
    canDeleteTopping: true,
    canViewAllOrders: true,
    canCancelOrder: true,
    canTransferOrder: true,
    canViewMetrics: true,
    canViewAllSedesMetrics: true,
    canViewConfigurations: true,
    canEditConfigurations: true,
  },
  
  administrador_punto: {
    // Administrador de punto: acceso limitado a su sede
    canViewAllSedes: false,
    canCreateSede: false,
    canEditSede: true, // Solo puede editar su sede
    canDeleteSede: false,
    canCreateUser: true, // Solo para su sede
    canEditUserRole: true, // Solo usuarios de su sede
    canDeleteUser: true, // Solo usuarios de su sede
    canAssignUserToOtherSede: false,
    canCreateRepartidor: true, // Solo para su sede
    canEditRepartidor: true, // Solo repartidores de su sede
    canDeleteRepartidor: true, // Solo repartidores de su sede
    canAssignRepartidorToOtherSede: false,
    canCreateProduct: true,
    canEditProduct: true,
    canDeleteProduct: true,
    canCreateTopping: true,
    canEditTopping: true,
    canDeleteTopping: true,
    canViewAllOrders: false, // Solo órdenes de su sede
    canCancelOrder: true,
    canTransferOrder: false, // No puede transferir a otras sedes
    canViewMetrics: true,
    canViewAllSedesMetrics: false, // Solo métricas de su sede
    canViewConfigurations: true,
    canEditConfigurations: true,
  },
  
  agent: {
    // Agente: acceso muy limitado, principalmente visualización
    canViewAllSedes: false,
    canCreateSede: false,
    canEditSede: false,
    canDeleteSede: false,
    canCreateUser: false,
    canEditUserRole: false,
    canDeleteUser: false,
    canAssignUserToOtherSede: false,
    canCreateRepartidor: false,
    canEditRepartidor: false,
    canDeleteRepartidor: false,
    canAssignRepartidorToOtherSede: false,
    canCreateProduct: false,
    canEditProduct: false,
    canDeleteProduct: false,
    canCreateTopping: false,
    canEditTopping: false,
    canDeleteTopping: false,
    canViewAllOrders: false,
    canCancelOrder: false,
    canTransferOrder: false,
    canViewMetrics: false,
    canViewAllSedesMetrics: false,
    canViewConfigurations: false,
    canEditConfigurations: false,
  },
};

// Hook principal para gestión de permisos
export const usePermissions = () => {
  const { profile } = useAuth();
  
  const userRole = useMemo(() => {
    if (!profile?.role) return 'agent';
    
    // Mapear roles de la base de datos al tipo definido
    switch (profile.role.toLowerCase()) {
      case 'admin':
      case 'administrador':
      case 'admin_global':  // Nuevo rol agregado
        return 'admin';
      case 'administrador_punto':
      case 'admin_punto':   // Nuevo rol agregado
      case 'administrador de punto':
        return 'administrador_punto';
      case 'agent':
      case 'agente':
        return 'agent';
      default:
        return 'agent'; // Rol por defecto más restrictivo
    }
  }, [profile?.role]) as UserRole;
  
  const permissions = useMemo(() => {
    return ROLE_PERMISSIONS[userRole];
  }, [userRole]);
  
  const canAccessResource = useMemo(() => {
    return (resourceSedeId?: string | null) => {
      if (userRole === 'admin') {
        return true; // Admin tiene acceso a todo
      }
      
      if (userRole === 'administrador_punto' || userRole === 'agent') {
        // Solo puede acceder a recursos de su sede
        return !resourceSedeId || resourceSedeId === profile?.sede_id;
      }
      
      return false;
    };
  }, [userRole, profile?.sede_id]);
  
  const isAdmin = userRole === 'admin';
  const isAdministradorPunto = userRole === 'administrador_punto';
  const isAgent = userRole === 'agent';
  
  return {
    userRole,
    permissions,
    canAccessResource,
    isAdmin,
    isAdministradorPunto,
    isAgent,
    userSedeId: profile?.sede_id,
  };
};

// Hook de conveniencia para verificar permisos específicos
export const usePermission = (permission: keyof Permissions) => {
  const { permissions } = usePermissions();
  return permissions[permission];
};

// Utilidad para verificar si un rol puede realizar una acción en una sede específica
export const canPerformActionInSede = (
  userRole: UserRole,
  userSedeId: string | null,
  targetSedeId: string | null
): boolean => {
  if (userRole === 'admin') return true;
  if (!userSedeId) return false;
  return userSedeId === targetSedeId;
};