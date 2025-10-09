import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit, Trash2, Users, Building2, UserCheck, UserX, TrendingUp, DollarSign, Package, Clock, LayoutDashboard, Phone, MapPin, Settings, RefreshCw, Cog, ChartLine, Timer, BarChart3, Truck, Eye, AlertTriangle, ChevronLeft, ChevronRight, XCircle, Star, BarChart, Activity, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { supabase, type Database } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useAdminTab } from '@/hooks/useAdminTab'
import { useAdminSection } from '@/hooks/useAdminSection'
import { useLoadingStates } from '@/hooks/useLoadingStates'
import { adminService, CreateUserData, User, CreateSedeData, UpdateSedeData, Sede, Repartidor } from '@/services/adminService'
import { customAuthService } from '@/services/customAuthService'
import { metricsService, DashboardMetrics, MetricsFilters } from '@/services/metricsService'
import { adminDataLoader } from '@/services/adminDataLoader'
import { optimisticAdd, optimisticUpdate, optimisticDelete } from '@/utils/optimisticUpdates'
import { SectionLoading, TableSectionLoading, MetricsLoading, StatusIndicator } from '@/components/LoadingIndicators'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { logger } from '@/utils/logger'
import { CancelledOrdersModal } from '@/components/CancelledOrdersModal'
import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics'
import { DeliveryPersonMetrics } from '@/components/DeliveryPersonMetrics'
import { CRM } from '@/components/CRM'
import { DiscountMetrics } from '@/components/DiscountMetrics'
import { OrderStatesStatsPanel } from '@/components/OrderStatesStatsPanel'
import { ExportButton } from '@/components/ui/ExportButton'
import { formatters, type TableColumn } from '@/utils/exportUtils'

type Profile = User


interface AdminPanelProps {
  onBack?: () => void;
  onNavigateToTimeMetrics?: () => void;
}

export function AdminPanel({ onBack, onNavigateToTimeMetrics }: AdminPanelProps) {
  // Data state with optimistic updates support
  const [users, setUsers] = useState<Profile[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedesSimple, setSedesSimple] = useState<Array<{ id: string; name: string }>>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  
  // Loading states management
  const {
    loadingStates,
    isAnyLoading,
    startLoading,
    finishLoading,
    clearError,
    incrementRetry,
    resetSection,
    getLoadingInfo
  } = useLoadingStates()

  // Dialog and form states
  const [selectedRepartidor, setSelectedRepartidor] = useState<Repartidor | null>(null)
  const [isRepartidorSedeEditOpen, setIsRepartidorSedeEditOpen] = useState(false)
  const [repartidorSedeFormData, setRepartidorSedeFormData] = useState({ sede_id: 'none' })
  const [isCreateRepartidorOpen, setIsCreateRepartidorOpen] = useState(false)
  const [isDeleteRepartidorOpen, setIsDeleteRepartidorOpen] = useState(false)
  const [repartidorFormData, setRepartidorFormData] = useState({
    nombre: '',
    telefono: '',
    placas: '',
    sede_id: 'none'
  })
  
  // Cancelled orders modal state
  const [isCancelledOrdersModalOpen, setIsCancelledOrdersModalOpen] = useState(false)
  const [selectedSedeForCancelled, setSelectedSedeForCancelled] = useState<{id: string, nombre: string} | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  // Removed global loading state - now using section-specific states
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [isCreateSedeOpen, setIsCreateSedeOpen] = useState(false)
  const [isEditSedeOpen, setIsEditSedeOpen] = useState(false)
  const [isCreatingSede, setIsCreatingSede] = useState(false)
  const [isUserSedeEditOpen, setIsUserSedeEditOpen] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [selectedSede, setSelectedSede] = useState<Sede | null>(null)
  const [userSedeFormData, setUserSedeFormData] = useState({ sede_id: '' })
  const [showMainApp, setShowMainApp] = useState(false)
  const { activeTab, setActiveTab, resetToUsers } = useAdminTab()
  const { activeSection, setActiveSection } = useAdminSection()

  const { toast } = useToast()
  const { user, signOut } = useAuth()

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    password: '',
    role: 'agent' as 'admin' | 'agent' | 'admin_punto' | 'admin_global',
    sede_id: '',
    is_active: true
  })

  const [sedeFormData, setSedeFormData] = useState({
    name: '',
    address: '',
    phone: '',
    is_active: true
  })

  // Estados para métricas
  const [metricsData, setMetricsData] = useState<DashboardMetrics | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSedeFilter, setSelectedSedeFilter] = useState<string>('all') // 'all' o un ID de sede
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(), // Hoy por defecto
    to: new Date()    // Hoy por defecto
  })

  // Configurar filtro de sede automáticamente para admin_punto
  useEffect(() => {
    if (user?.role === 'admin_punto' && user?.sede_id) {
      setSelectedSedeFilter(user.sede_id);
      console.log('🏢 Admin punto: configurando filtro automático a sede', user.sede_name || user.sede_id);
    }
  }, [user?.role, user?.sede_id, user?.sede_name]);

  // Initialize data loading on mount
  useEffect(() => {
    logger.info('🚀 AdminPanel iniciando con carga optimizada...')
    loadInitialData()
  }, [])

  // Optimized metrics loading with debouncing  
  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      logger.info('🔄 Recargando métricas con debounce...')
      loadMetricsOptimized()
    }
  }, [dateRange, selectedSedeFilter])

  // Optimized data loading functions with timeout and retry
  const loadInitialData = useCallback(async () => {
    logger.info('🚀 Starting optimized initial data load')
    
    try {
      const result = await adminDataLoader.loadAllData(false, undefined, {
        sequential: true, // Use sequential loading to avoid connection stress
        useCache: true
      })
      
      // Update users
      if (result.users.success && result.users.data) {
        setUsers(result.users.data)
        finishLoading('users')
      } else {
        finishLoading('users', result.users.error)
      }
      
      // Update sedes (both simple and complete)
      if (result.sedes.success && result.sedes.data) {
        setSedes(result.sedes.data.complete)
        setSedesSimple(result.sedes.data.simple)
        finishLoading('sedes')
      } else {
        finishLoading('sedes', result.sedes.error)
      }
      
      // Update repartidores
      if (result.repartidores.success && result.repartidores.data) {
        setRepartidores(result.repartidores.data)
        finishLoading('repartidores')
      } else {
        finishLoading('repartidores', result.repartidores.error)
      }
      
      
      logger.info('Initial data load completed', {
        totalAttempts: result.totalAttempts,
        usersLoaded: !!result.users.success,
        sedesLoaded: !!result.sedes.success,
        repartidoresLoaded: !!result.repartidores.success
      })
      
    } catch (error) {
      logger.error('Initial data load failed', { error })
      finishLoading('users', 'Error de conexión')
      finishLoading('sedes', 'Error de conexión')
      finishLoading('repartidores', 'Error de conexión')
    }
  }, [finishLoading])


  // Retry functions for individual sections
  const retrySection = useCallback(async (section: 'users' | 'sedes' | 'repartidores') => {
    startLoading(section)
    incrementRetry(section)
    
    try {
      switch (section) {
        case 'users': {
          const result = await adminDataLoader.loadUsers({ useCache: false })
          if (result.success && result.data) {
            setUsers(result.data)
            finishLoading('users')
          } else {
            finishLoading('users', result.error)
          }
          break
        }
        case 'sedes': {
          const result = await adminDataLoader.loadSedes({ useCache: false })
          if (result.success && result.data) {
            setSedes(result.data.complete)
            setSedesSimple(result.data.simple)
            finishLoading('sedes')
          } else {
            finishLoading('sedes', result.error)
          }
          break
        }
        case 'repartidores': {
          const result = await adminDataLoader.loadRepartidores({ useCache: false })
          if (result.success && result.data) {
            setRepartidores(result.data)
            finishLoading('repartidores')
          } else {
            finishLoading('repartidores', result.error)
          }
          break
        }
      }
    } catch (error) {
      finishLoading(section, 'Error de conexión')
    }
  }, [startLoading, finishLoading, incrementRetry])

  // Optimized metrics loading with debouncing and caching
  const loadMetricsOptimized = useCallback(async () => {
    startLoading('metrics')
    
    try {
      const filters: MetricsFilters = {
        fecha_inicio: format(dateRange.from, 'yyyy-MM-dd'),
        fecha_fin: format(dateRange.to, 'yyyy-MM-dd'),
        sede_id: selectedSedeFilter === 'all' ? undefined : selectedSedeFilter
      }
      
      logger.info('Loading metrics with optimized loader', { filters })
      
      const result = await adminDataLoader.loadMetrics(filters, { useCache: true })
      
      if (result.success && result.data) {
        setMetricsData(result.data)
        finishLoading('metrics')
        logger.info('Metrics loaded successfully', {
          metricasPorDia: result.data.metricasPorDia?.length || 0,
          totalPedidos: result.data.totalGeneral?.pedidos || 0
        })
      } else {
        finishLoading('metrics', result.error)
        if (!result.timedOut) {
          toast({
            title: 'Error',
            description: result.error || 'No se pudieron cargar las métricas',
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      logger.error('Metrics loading failed', { error });
      finishLoading('metrics', 'Error de conexión')
    }
  }, [dateRange, selectedSedeFilter, startLoading, finishLoading, toast])

  // Cancelled orders modal handler
  const handleShowCancelledOrders = (sedeId: string, sedeNombre: string) => {
    setSelectedSedeForCancelled({ id: sedeId, nombre: sedeNombre });
    setIsCancelledOrdersModalOpen(true);
  };

  // Real-time metrics updates
  useRealtimeMetrics({
    sedeId: selectedSedeFilter === 'all' ? undefined : selectedSedeFilter,
    onMetricsUpdated: () => {
      console.log('📊 AdminPanel: Métricas actualizadas en tiempo real, recargando...');
      // Recargar métricas automáticamente sin mostrar loading
      if (!loadingStates.metrics?.loading) {
        loadMetrics();
      }
    },
    onOrderInserted: (order) => {
      console.log('📝 AdminPanel: Nueva orden detectada:', order);
      toast({
        title: "Nueva orden",
        description: `Orden #${order.id} creada`,
      });
    },
    onOrderUpdated: (order) => {
      console.log('✏️ AdminPanel: Orden actualizada:', order);
    },
    onOrderDeleted: (orderId) => {
      console.log('🗑️ AdminPanel: Orden eliminada:', orderId);
      toast({
        title: "Orden eliminada",
        description: `Orden #${orderId} eliminada`,
      });
    },
    enabled: activeSection === 'dashboard' // Solo activar cuando estemos en la sección de dashboard/métricas
  });

  // Optimistic CRUD operations
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsCreatingUser(true);
      logger.info('Creating user with optimistic updates...')
      
      // Para admin_punto: forzar que el usuario se cree solo en su sede
      let sedeId = formData.sede_id;
      if (user?.role === 'admin_punto') {
        sedeId = user.sede_id; // Forzar la sede del admin_punto
        console.log('🏢 Admin punto: forzando creación de usuario en sede', user.sede_name);
      }
      
      // Validar que se haya seleccionado una sede (obligatorio)
      if (!sedeId) {
        toast({
          title: "Error",
          description: "Debes seleccionar una sede para el usuario.",
          variant: "destructive"
        });
        setIsCreatingUser(false);
        return;
      }

      // Validar permisos de creación según rol del usuario actual
      if (user?.role === 'admin_punto' && formData.role !== 'agent') {
        toast({
          title: "Error de permisos",
          description: "Como Admin de Punto solo puedes crear usuarios con rol Agente.",
          variant: "destructive"
        });
        setIsCreatingUser(false);
        return;
      }
      
      const userData = {
        nickname: formData.nickname,
        password: formData.password,
        display_name: formData.name,
        role: formData.role,
        sede_id: sedeId,
        is_active: formData.is_active
      };

      // Create temporary user for optimistic update
      const tempUser: User = {
        id: 'temp-' + Date.now(),
        nickname: userData.nickname,
        display_name: userData.display_name,
        role: userData.role,
        sede_id: userData.sede_id,
        is_active: userData.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add temp user for optimistic update
      setUsers(prev => [...prev, tempUser]);

      try {
        const result = await customAuthService.createUser(userData);
      
      if (result.error) {
        // Remove temp user on error
        setUsers(prev => prev.filter(u => u.id !== tempUser.id));
        toast({
          title: "Error al crear usuario",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      // Success - reload users to get the real data
      toast({
        title: "Usuario creado exitosamente",
        description: `${formData.name} ha sido creado y puede iniciar sesión inmediatamente con: ${formData.nickname}`,
      });
      
      setFormData({
        name: '',
        nickname: '',
        password: '',
        role: 'agent',
        sede_id: '',
        is_active: true
      });
      
      setIsCreateUserOpen(false);
      
      // Reload users data
      adminDataLoader.invalidateCache(['users']);
        
      } catch (error: any) {
        // Remove temp user on error
        setUsers(prev => prev.filter(u => u.id !== tempUser.id));
        throw error; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      // Remove temp user on error
      setUsers(prev => prev.filter(u => u.id !== tempUser.id));
      logger.error('Error creating user:', error);
      toast({
        title: 'Error al crear usuario',
        description: error.message || 'Ocurrió un error inesperado',
        variant: "destructive",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleUserSedeEdit = (user: Profile) => {
    setSelectedUser(user);
    setUserSedeFormData({ sede_id: user.sede_id || '' });
    setIsUserSedeEditOpen(true);
  };

  const handleUpdateUserSede = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;
    
    try {
      const updates = { sede_id: userSedeFormData.sede_id };
      
      const { optimisticItems, execute } = optimisticUpdate(
        users,
        selectedUser.id,
        updates,
        () => adminService.updateUserSede(selectedUser.id, userSedeFormData.sede_id),
        {
          onSuccess: () => {
            toast({
              title: "Sede actualizada",
              description: `La sede de ${selectedUser.name} ha sido actualizada exitosamente.`,
            })
            setIsUserSedeEditOpen(false);
            setSelectedUser(null);
            setUserSedeFormData({ sede_id: '' });
            adminDataLoader.invalidateCache(['users']);
          },
          onError: (error, rollback) => {
            // Rollback optimistic update
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? selectedUser : u));
            toast({
              title: "Error",
              description: error.message || "No se pudo actualizar la sede del usuario",
              variant: "destructive",
            })
          }
        }
      );
      
      // Apply optimistic update
      setUsers(optimisticItems);
      
      // Execute actual operation
      await execute();
    } catch (error: any) {
      logger.error('Error updating user sede:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la sede del usuario",
        variant: "destructive",
      });
    }
  };

  const handleCreateSede = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsCreatingSede(true);
    
    try {
      logger.info('Creating sede with optimistic updates...')
      
      const sedeData: CreateSedeData = {
        name: sedeFormData.name,
        address: sedeFormData.address,
        phone: sedeFormData.phone,
        is_active: sedeFormData.is_active
      }

      // Create temporary sede for optimistic update
      const tempSede: Sede = {
        id: 'temp-' + Date.now(),
        name: sedeData.name,
        address: sedeData.address,
        phone: sedeData.phone,
        current_capacity: 0,
        max_capacity: 50,
        is_active: sedeData.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { optimisticItems, execute } = optimisticAdd(
        sedes,
        tempSede,
        () => adminService.createSede(sedeData),
        {
          onSuccess: (newSede) => {
            // Update both sedes arrays
            setSedes(prev => prev.map(s => s.id === tempSede.id ? newSede : s))
            setSedesSimple(prev => [...prev.filter(s => s.id !== tempSede.id), { id: newSede.id, name: newSede.name }])
            
            toast({
              title: "Sede creada",
              description: `La sede ${sedeFormData.name} ha sido creada exitosamente`,
            })
            setSedeFormData({
              name: '',
              address: '',
              phone: '',
              is_active: true
            })
            setIsCreateSedeOpen(false)
            adminDataLoader.invalidateCache(['sedes'])
          },
          onError: (error, rollback) => {
            setSedes(prev => prev.filter(s => s.id !== tempSede.id))
            setSedesSimple(prev => prev.filter(s => s.id !== tempSede.id))
            toast({
              title: "Error",
              description: error.message || "No se pudo crear la sede",
              variant: "destructive",
            })
          }
        }
      )

      // Apply optimistic updates
      setSedes(optimisticItems)
      setSedesSimple(prev => [...prev, { id: tempSede.id, name: tempSede.name }])
      
      // Execute actual operation
      await execute()
    } catch (error: any) {
      logger.error('Error creating sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la sede",
        variant: "destructive",
      })
    } finally {
      setIsCreatingSede(false);
    }
  };

  const handleEditSede = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSede) return;

    try {
      logger.info('Updating sede with optimistic updates...')
      
      const updateData: UpdateSedeData = {
        name: sedeFormData.name,
        address: sedeFormData.address,
        phone: sedeFormData.phone,
        is_active: sedeFormData.is_active
      }

      const { optimisticItems, execute } = optimisticUpdate(
        sedes,
        selectedSede.id,
        updateData,
        () => adminService.updateSede(selectedSede.id, updateData),
        {
          onSuccess: (updatedSede) => {
            // Update both arrays
            setSedes(prev => prev.map(s => s.id === selectedSede.id ? updatedSede : s))
            setSedesSimple(prev => prev.map(s => s.id === selectedSede.id ? { id: updatedSede.id, name: updatedSede.name } : s))
            
            toast({
              title: "Sede actualizada",
              description: `La sede ${sedeFormData.name} ha sido actualizada exitosamente`,
            })
            setSedeFormData({
              name: '',
              address: '',
              phone: '',
              is_active: true
            })
            setIsEditSedeOpen(false)
            setSelectedSede(null)
            adminDataLoader.invalidateCache(['sedes'])
          },
          onError: (error, rollback) => {
            setSedes(prev => prev.map(s => s.id === selectedSede.id ? selectedSede : s))
            toast({
              title: "Error",
              description: error.message || "No se pudo actualizar la sede",
              variant: "destructive",
            })
          }
        }
      )
      
      // Apply optimistic update
      setSedes(optimisticItems)
      
      // Execute actual operation
      await execute()
    } catch (error: any) {
      logger.error('Error updating sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la sede",
        variant: "destructive",
      })
    }
  };

  const handleDeleteSede = async (sede: Sede) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la sede "${sede.name}"?`)) {
      return;
    }

    try {
      logger.info('Deleting sede with optimistic updates...')
      
      const { optimisticItems, execute } = optimisticDelete(
        sedes,
        sede.id,
        () => adminService.deleteSede(sede.id),
        {
          onSuccess: () => {
            setSedesSimple(prev => prev.filter(s => s.id !== sede.id))
            toast({
              title: "Sede eliminada",
              description: `La sede ${sede.name} ha sido eliminada exitosamente`,
            })
            adminDataLoader.invalidateCache(['sedes'])
          },
          onError: (error, rollback) => {
            setSedes(prev => [...prev, sede])
            toast({
              title: "Error",
              description: error.message || "No se pudo eliminar la sede",
              variant: "destructive",
            })
          }
        }
      )
      
      // Apply optimistic update
      setSedes(optimisticItems)
      
      // Execute actual operation
      await execute()
    } catch (error: any) {
      logger.error('Error deleting sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la sede",
        variant: "destructive",
      })
    }
  };

  const openEditSede = (sede: Sede) => {
    setSelectedSede(sede);
    setSedeFormData({
      name: sede.name,
      address: sede.address,
      phone: sede.phone,
      is_active: sede.is_active
    });
    setIsEditSedeOpen(true);
  };

  const handleInitializeSedeProducts = async (sede: Sede) => {
    if (!confirm(`¿Inicializar productos para la sede "${sede.name}"?\n\nEsto creará registros de productos, bebidas y toppings con disponibilidad activada.`)) {
      return;
    }

    try {
      logger.info('Initializing sede products:', sede.name, sede.id)
      
      await adminService.initializeExistingSedeProducts(sede.id)

      toast({
        title: "Productos inicializados",
        description: `Productos inicializados exitosamente para la sede "${sede.name}"`,
      })

      // Optionally reload sedes data
      await retrySection('sedes')
      
    } catch (error: any) {
      logger.error('Error initializing sede products:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudieron inicializar los productos para la sede",
        variant: "destructive",
      })
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const updates = { is_active: !currentStatus }
      
      const { optimisticItems, execute } = optimisticUpdate(
        users,
        userId,
        updates,
        () => adminService.updateUserStatus(userId, !currentStatus),
        {
          onSuccess: () => {
            toast({
              title: currentStatus ? "Usuario desactivado" : "Usuario activado",
              description: `El usuario ha sido ${currentStatus ? 'desactivado' : 'activado'} exitosamente`,
            })
            adminDataLoader.invalidateCache(['users'])
          },
          onError: (error, rollback) => {
            const originalUser = users.find(u => u.id === userId)
            if (originalUser) {
              setUsers(prev => prev.map(u => u.id === userId ? originalUser : u))
            }
            toast({
              title: "Error",
              description: "No se pudo actualizar el usuario",
              variant: "destructive",
            })
          }
        }
      )
      
      setUsers(optimisticItems)
      await execute()
    } catch (error: any) {
      logger.error('Error updating user:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async (userId: string, userDisplayName: string, userNickname: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el usuario "${userDisplayName}" (@${userNickname})? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      const { optimisticItems, execute } = optimisticDelete(
        users,
        userId,
        () => adminService.deleteUser(userId),
        {
          onSuccess: () => {
            toast({
              title: "Usuario eliminado",
              description: `El usuario ${userDisplayName} ha sido eliminado exitosamente`,
            })
            adminDataLoader.invalidateCache(['users'])
          },
          onError: (error, rollback) => {
            const deletedUser = users.find(u => u.id === userId)
            if (deletedUser) {
              setUsers(prev => [...prev, deletedUser])
            }
            toast({
              title: "Error",
              description: "No se pudo eliminar el usuario",
              variant: "destructive",
            })
          }
        }
      )
      
      setUsers(optimisticItems)
      await execute()
    } catch (error: any) {
      logger.error('Error deleting user:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive",
      })
    }
  }

  // ======= FUNCIONES PARA REPARTIDORES =======

  const handleRepartidorSedeEdit = (repartidor: Repartidor) => {
    setSelectedRepartidor(repartidor);
    setRepartidorSedeFormData({ sede_id: repartidor.sede_id || 'none' });
    setIsRepartidorSedeEditOpen(true);
  };

  const handleUpdateRepartidorSede = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRepartidor) return;
    
    try {
      const updates = { sede_id: repartidorSedeFormData.sede_id === 'none' ? null : repartidorSedeFormData.sede_id || null }
      
      const { optimisticItems, execute } = optimisticUpdate(
        repartidores,
        selectedRepartidor.id,
        updates,
        () => adminService.updateRepartidorSede(selectedRepartidor.id, repartidorSedeFormData.sede_id === 'none' ? null : repartidorSedeFormData.sede_id || null),
        {
          onSuccess: () => {
            toast({
              title: "Sede actualizada",
              description: `La sede del repartidor ${selectedRepartidor.nombre} ha sido actualizada exitosamente`,
            })
            setIsRepartidorSedeEditOpen(false)
            setSelectedRepartidor(null)
            setRepartidorSedeFormData({ sede_id: 'none' })
            adminDataLoader.invalidateCache(['repartidores'])
          },
          onError: (error, rollback) => {
            setRepartidores(prev => prev.map(r => r.id === selectedRepartidor.id ? selectedRepartidor : r))
            toast({
              title: "Error",
              description: error.message || "No se pudo actualizar la sede del repartidor",
              variant: "destructive",
            })
          }
        }
      )
      
      setRepartidores(optimisticItems)
      await execute()
    } catch (error: any) {
      logger.error('Error updating repartidor sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la sede del repartidor",
        variant: "destructive",
      })
    }
  }

  const toggleRepartidorStatus = async (repartidorId: number, currentStatus: boolean) => {
    try {
      const updates = { disponible: !currentStatus }
      
      const { optimisticItems, execute } = optimisticUpdate(
        repartidores,
        repartidorId,
        updates,
        () => adminService.updateRepartidorStatus(repartidorId, !currentStatus),
        {
          onSuccess: () => {
            toast({
              title: currentStatus ? "Repartidor desactivado" : "Repartidor activado",
              description: `El repartidor ha sido ${currentStatus ? 'desactivado' : 'activado'} exitosamente`,
            })
            adminDataLoader.invalidateCache(['repartidores'])
          },
          onError: (error, rollback) => {
            const originalRepartidor = repartidores.find(r => r.id === repartidorId)
            if (originalRepartidor) {
              setRepartidores(prev => prev.map(r => r.id === repartidorId ? originalRepartidor : r))
            }
            toast({
              title: "Error",
              description: "No se pudo actualizar el repartidor",
              variant: "destructive",
            })
          }
        }
      )
      
      setRepartidores(optimisticItems)
      await execute()
    } catch (error: any) {
      logger.error('Error updating repartidor:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el repartidor",
        variant: "destructive",
      })
    }
  }

  const handleCreateRepartidor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repartidorFormData.nombre.trim() || !repartidorFormData.telefono.trim()) {
      toast({
        title: 'Error',
        description: "Por favor completa los campos obligatorios (nombre y teléfono)",
        variant: "destructive",
      })
      return
    }

    try {
      // Para admin_punto, forzar la sede a la suya propia
      const sedeIdToUse = user?.role === 'admin_punto' ? user.sede_id :
        (repartidorFormData.sede_id === 'none' ? null : repartidorFormData.sede_id || null);

      const tempRepartidor: Repartidor = {
        id: Date.now(), // Temporary ID
        nombre: repartidorFormData.nombre.trim(),
        telefono: repartidorFormData.telefono.trim(),
        placas: repartidorFormData.placas.trim() || undefined,
        sede_id: sedeIdToUse,
        disponible: true,
        created_at: new Date().toISOString()
      }

      const { optimisticItems, execute } = optimisticAdd(
        repartidores,
        tempRepartidor,
        () => adminService.createRepartidor({
          nombre: repartidorFormData.nombre.trim(),
          telefono: repartidorFormData.telefono.trim(),
          placas: repartidorFormData.placas.trim() || undefined,
          sede_id: sedeIdToUse
        }),
        {
          onSuccess: (newRepartidor) => {
            setRepartidores(prev => prev.map(r => r.id === tempRepartidor.id ? newRepartidor : r))
            toast({
              title: "Repartidor creado",
              description: `El repartidor ${repartidorFormData.nombre} ha sido creado exitosamente`,
            })
            setIsCreateRepartidorOpen(false)
            setRepartidorFormData({
              nombre: '',
              telefono: '',
              placas: '',
              sede_id: 'none'
            })
            adminDataLoader.invalidateCache(['repartidores'])
          },
          onError: (error, rollback) => {
            setRepartidores(prev => prev.filter(r => r.id !== tempRepartidor.id))
            toast({
              title: "Error",
              description: error.message || "No se pudo crear el repartidor",
              variant: "destructive",
            })
          }
        }
      )

      setRepartidores(optimisticItems)
      await execute()
    } catch (error: any) {
      logger.error('Error creating repartidor:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el repartidor",
        variant: "destructive",
      })
    }
  }

  const handleDeleteRepartidor = async () => {
    if (!selectedRepartidor) return

    try {
      const { optimisticItems, execute } = optimisticDelete(
        repartidores,
        selectedRepartidor.id,
        () => adminService.deleteRepartidor(selectedRepartidor.id),
        {
          onSuccess: () => {
            toast({
              title: "Repartidor eliminado",
              description: `El repartidor ${selectedRepartidor.nombre} ha sido eliminado exitosamente`,
            })
            setIsDeleteRepartidorOpen(false)
            setSelectedRepartidor(null)
            adminDataLoader.invalidateCache(['repartidores'])
          },
          onError: (error, rollback) => {
            setRepartidores(prev => [...prev, selectedRepartidor])
            toast({
              title: "Error",
              description: error.message || "No se pudo eliminar el repartidor",
              variant: "destructive",
            })
          }
        }
      )

      setRepartidores(optimisticItems)
      await execute()
    } catch (error: any) {
      logger.error('Error deleting repartidor:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el repartidor",
        variant: "destructive",
      })
    }
  }

  const filteredUsers = users.filter(userRow => {
    // Filtro de b├║squeda
    // Filtro de búsqueda
    const matchesSearch = userRow.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userRow.nickname?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por rol: admin_punto solo ve usuarios de su sede
    if (user?.role === 'admin_punto') {
      return matchesSearch && userRow.sede_id === user?.sede_id;
    }
    
    // admin_global ve todos los usuarios
    return matchesSearch;
  })

  const filteredRepartidores = repartidores.filter(repartidor => {
    // Filtro de b├║squeda
    // Filtro de búsqueda
    const matchesSearch = repartidor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         repartidor.telefono.includes(searchTerm) ||
                         (repartidor.placas && repartidor.placas.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filtro por rol: admin_punto solo ve repartidores de su sede
    if (user?.role === 'admin_punto') {
      return matchesSearch && repartidor.sede_id === user?.sede_id;
    }
    
    // admin_global ve todos los repartidores
    return matchesSearch;
  })

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Administrador</Badge>;
      case 'admin_global':
        return <Badge variant="destructive">Admin Global</Badge>;
      case 'admin_punto':
        return <Badge variant="default">Admin de Punto</Badge>;
      case 'agent':
        return <Badge variant="secondary">Agente</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  logger.info('🎨 Rendering optimized AdminPanel', {
    isAnyLoading,
    usersCount: users.length,
    sedesCount: sedes.length,
    repartidoresCount: repartidores.length
  })

  // Si showMainApp es true, mostrar la aplicaci├│n principal
  // Si showMainApp es true, mostrar la aplicación principal
  if (showMainApp) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header con bot├│n de regreso */}
        {/* Header con botón de regreso */}
        <div className="border-b bg-card">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">A&F</span>
              </div>
              <h1 className="text-xl font-semibold">Aplicación Principal</h1>
            </div>
            <div className="flex items-center space-x-2">
                               <Button
                  variant="outline"
                  onClick={() => {
                    if (onBack) {
                      onBack();
                    } else {
                      setShowMainApp(false);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Volver a Admin
                </Button>
              <Button variant="outline" onClick={signOut}>
                Cerrar Sesi├│n
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
        
        {/* Aquí iría el contenido de la aplicación principal */}
        <div className="p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Bienvenido a la Aplicaci├│n Principal</h2>
            <h2 className="text-2xl font-bold mb-4">Bienvenido a la Aplicación Principal</h2>
            <p className="text-muted-foreground mb-6">
              Aquí puedes gestionar pedidos, inventario, repartidores y más.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6 text-center cursor-pointer hover:shadow-md transition-shadow">
                <LayoutDashboard className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">Dashboard</h3>
                <p className="text-sm text-muted-foreground">Ver estadísticas</p>
              </Card>
              <Card className="p-6 text-center cursor-pointer hover:shadow-md transition-shadow">
                <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">Inventario</h3>
                <p className="text-sm text-muted-foreground">Gestionar productos</p>
              </Card>
              <Card className="p-6 text-center cursor-pointer hover:shadow-md transition-shadow">
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">Repartidores</h3>
                <p className="text-sm text-muted-foreground">Gestionar personal</p>
              </Card>
              <Card className="p-6 text-center cursor-pointer hover:shadow-md transition-shadow">
                <Phone className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold">Call Center</h3>
                <p className="text-sm text-muted-foreground">Atención al cliente</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">A&F</span>
            </div>
            <h1 className="text-xl font-semibold">Panel de Administración</h1>
            {/* Overall loading indicator */}
            <StatusIndicator
              isLoading={isAnyLoading}
              error={null}
              lastUpdated={null}
              size="sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            {/* Botón de Inicio - Solo visible si no estamos en la vista de usuarios */}
            {activeTab !== 'users' && (
              <Button
                variant="outline"
                onClick={resetToUsers}
                className="flex items-center gap-2"
                title="Volver a Usuarios"
              >
                <Users className="h-4 w-4" />
                Inicio
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => {
                if (onBack) {
                  onBack();
                } else {
                  setShowMainApp(true);
                }
              }}
              className="flex items-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Ir a Aplicación
            </Button>
            <Button variant="outline" onClick={signOut}>
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Navegación entre secciones */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          <Button
            variant={activeSection === 'config' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('config')}
            className="flex items-center gap-2"
          >
            <Cog className="h-4 w-4" />
            Configuraciones
          </Button>
          <Button
            variant={activeSection === 'metrics' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('metrics')}
            className="flex items-center gap-2"
          >
            <ChartLine className="h-4 w-4" />
            Métricas
          </Button>
          <Button
            variant={activeSection === 'orderStates' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('orderStates')}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Estados de Órdenes
          </Button>
          <Button
            variant={activeSection === 'crm' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('crm')}
            className="flex items-center gap-2"
          >
            <BarChart className="h-4 w-4" />
            CRM
          </Button>
        </div>

        {activeSection === 'config' && (
          /* ========== SECCIÓN DE CONFIGURACIONES ========== */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <StatusIndicator {...getLoadingInfo('users')} size="sm" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {user?.role === 'admin_punto' ? filteredUsers.length : users.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'admin_punto' 
                      ? filteredUsers.filter(u => u.is_active).length 
                      : users.filter(u => u.is_active).length
                    } activos {user?.role === 'admin_punto' ? 'en tu sede' : ''}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {user?.role === 'admin_punto' ? 'Total Repartidores' : 'Total Sedes'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {user?.role === 'admin_punto' ? (
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <StatusIndicator {...getLoadingInfo(user?.role === 'admin_punto' ? 'repartidores' : 'sedes')} size="sm" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {user?.role === 'admin_punto' ? filteredRepartidores.length : sedes.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'admin_punto' 
                      ? `${filteredRepartidores.filter(r => r.is_active).length} activos en tu sede`
                      : 'Todas activas'
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Administradores</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {user?.role === 'admin_punto'
                      ? filteredUsers.filter(u => (u.role === 'admin_global' || u.role === 'admin_punto') && u.is_active).length
                      : users.filter(u => (u.role === 'admin' || u.role === 'admin_global' || u.role === 'admin_punto') && u.is_active).length
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'admin_punto'
                      ? 'Administradores en tu sede'
                      : 'Usuarios con permisos de administrador'
                    }
                  </p>
                </CardContent>
              </Card>

            </div>

        {/* Tabs para Gestión */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="sedes" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {user?.role === 'admin_global' ? 'Sedes' : 'Mi Sede'}
            </TabsTrigger>
            <TabsTrigger value="repartidores" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Repartidores
            </TabsTrigger>
          </TabsList>

          {/* Tab Content: Usuarios */}
          <TabsContent value="users">
            {/* Users Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle>Gestión de Usuarios</CardTitle>
                      <CardDescription>
                        Administra los usuarios del sistema
                      </CardDescription>
                    </div>
                    <StatusIndicator {...getLoadingInfo('users')} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => retrySection('users')}
                      disabled={loadingStates.users.isLoading}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingStates.users.isLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </Button>
                    <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Crear Usuario
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                          <DialogDescription>
                            Completa la información del nuevo usuario
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nickname">Nickname</Label>
                            <Input
                              id="nickname"
                              type="text"
                              value={formData.nickname}
                              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                              required
                              placeholder="Ej: admin_cedritos"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                              id="password"
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="role">Rol</Label>
                            <Select
                              value={formData.role}
                              onValueChange={(value: 'admin' | 'agent' | 'admin_punto' | 'admin_global') => setFormData({ ...formData, role: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agent">Agente</SelectItem>
                                {/* admin_punto solo puede crear agentes */}
                                {user?.role === 'admin_global' && (
                                  <>
                                    <SelectItem value="admin_punto">Admin de Punto</SelectItem>
                                    <SelectItem value="admin_global">Admin Global</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sede">
                              {user?.role === 'admin_punto' ? 'Sede Asignada' : 'Sede *'}
                            </Label>
                            {user?.role === 'admin_punto' ? (
                              // Para admin_punto: mostrar su sede asignada (no editable)
                              <div className="px-3 py-2 border rounded-md bg-muted">
                                📍 {user?.sede_name || 'Sede Asignada'}
                              </div>
                            ) : (
                              // Para admin_global: selector obligatorio
                              <Select
                                value={formData.sede_id}
                                onValueChange={(value) => setFormData({ ...formData, sede_id: value })}
                                required
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar sede" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sedesSimple.map((sede) => (
                                    <SelectItem key={sede.id} value={sede.id}>
                                      {sede.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="is_active"
                              checked={formData.is_active}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                            />
                            <Label htmlFor="is_active">Usuario activo</Label>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)} disabled={isCreatingUser}>
                              Cancelar
                            </Button>
                            <Button type="submit" disabled={isCreatingUser}>
                              {isCreatingUser ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Creando Usuario...
                                </>
                              ) : (
                                'Crear Usuario'
                              )}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                
                <SectionLoading
                  isLoading={loadingStates.users.isLoading}
                  error={loadingStates.users.error}
                  lastUpdated={loadingStates.users.lastUpdated}
                  retryCount={loadingStates.users.retryCount}
                  onRetry={() => retrySection('users')}
                  sectionName="usuarios"
                  className="mt-2"
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuarios..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  
                  <TableSectionLoading
                    isLoading={loadingStates.users.isLoading}
                    error={loadingStates.users.error}
                    onRetry={() => retrySection('users')}
                    sectionName="usuarios"
                    emptyMessage="No se encontraron usuarios"
                    itemCount={filteredUsers.length}
                  />

                  {!loadingStates.users.isLoading && !loadingStates.users.error && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead>Sede</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((tableUser) => (
                          <TableRow key={tableUser.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{tableUser.display_name}</div>
                                <div className="text-sm text-muted-foreground">@{tableUser.nickname}</div>
                              </div>
                            </TableCell>
                            <TableCell>{getRoleBadge(tableUser.role)}</TableCell>
                            <TableCell>
                              {tableUser.sede_id ? (
                                <span className="text-sm text-muted-foreground">
                                  {sedesSimple.find(s => s.id === tableUser.sede_id)?.name || 'N/A'}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Sin sede</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {tableUser.is_active ? (
                                <Badge variant="default">Activo</Badge>
                              ) : (
                                <Badge variant="secondary">Inactivo</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleUserStatus(tableUser.id, tableUser.is_active)}
                                  title={tableUser.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                                >
                                  {tableUser.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>
                                {/* Solo admin_global puede cambiar sede de usuarios */}
                                {user?.role === 'admin_global' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUserSedeEdit(tableUser)}
                                    title="Editar sede del usuario"
                                  >
                                    <Building2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {(user?.role === 'admin_global' || (user?.role === 'admin_punto' && tableUser.sede_id === user?.sede_id)) && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteUser(tableUser.id, tableUser.display_name, tableUser.nickname)}
                                    title="Eliminar usuario"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Content: Sedes */}
          <TabsContent value="sedes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle>{user?.role === 'admin_global' ? 'Gestión de Sedes' : 'Mi Sede'}</CardTitle>
                      <CardDescription>
                        {user?.role === 'admin_global' 
                          ? 'Administra las sedes del sistema'
                          : 'Configuración de tu sede asignada'
                        }
                      </CardDescription>
                    </div>
                    <StatusIndicator {...getLoadingInfo('sedes')} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => retrySection('sedes')}
                      disabled={loadingStates.sedes.isLoading}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingStates.sedes.isLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </Button>
                    {user?.role === 'admin_global' && (
                      <Dialog open={isCreateSedeOpen} onOpenChange={setIsCreateSedeOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Crear Sede
                          </Button>
                        </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Crear Nueva Sede</DialogTitle>
                          <DialogDescription>Completa la información de la nueva sede</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSede} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="sede-name">Nombre</Label>
                            <Input
                              id="sede-name"
                              value={sedeFormData.name}
                              onChange={(e) => setSedeFormData({ ...sedeFormData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sede-address">Dirección</Label>
                            <Input
                              id="sede-address"
                              value={sedeFormData.address}
                              onChange={(e) => setSedeFormData({ ...sedeFormData, address: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sede-phone">Teléfono</Label>
                            <Input
                              id="sede-phone"
                              type="tel"
                              value={sedeFormData.phone}
                              onChange={(e) => setSedeFormData({ ...sedeFormData, phone: e.target.value })}
                              required
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="sede-active"
                              checked={sedeFormData.is_active}
                              onCheckedChange={(checked) => setSedeFormData({ ...sedeFormData, is_active: checked })}
                            />
                            <Label htmlFor="sede-active">Sede activa</Label>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setIsCreateSedeOpen(false)}
                              disabled={isCreatingSede}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={isCreatingSede}
                              className="min-w-[100px]"
                            >
                              {isCreatingSede ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Creando...
                                </>
                              ) : (
                                'Crear Sede'
                              )}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                    )}
                  </div>
                </div>
                
                <SectionLoading
                  isLoading={loadingStates.sedes.isLoading}
                  error={loadingStates.sedes.error}
                  lastUpdated={loadingStates.sedes.lastUpdated}
                  retryCount={loadingStates.sedes.retryCount}
                  onRetry={() => retrySection('sedes')}
                  sectionName="sedes"
                  className="mt-2"
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar sedes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  <TableSectionLoading
                    isLoading={loadingStates.sedes.isLoading}
                    error={loadingStates.sedes.error}
                    onRetry={() => retrySection('sedes')}
                    sectionName="sedes"
                    emptyMessage="No se encontraron sedes"
                    itemCount={sedes.length}
                  />

                  {!loadingStates.sedes.isLoading && !loadingStates.sedes.error && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sede</TableHead>
                          <TableHead>Dirección</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Órdenes Activas</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sedes
                          .filter(sede => {
                            // Filtro de búsqueda
                            const matchesSearch = sede.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                sede.address.toLowerCase().includes(searchTerm.toLowerCase());
                            
                            // Filtro por rol: admin_punto solo ve su sede
                            if (user?.role === 'admin_punto') {
                              return matchesSearch && sede.id === user.sede_id;
                            }
                            
                            // admin_global ve todas las sedes
                            return matchesSearch;
                          })
                          .map((sede) => (
                          <TableRow key={sede.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{sede.name}</div>
                                <div className="text-sm text-muted-foreground">ID: {sede.id}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{sede.address}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{sede.phone}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <span className="font-medium">{sede.current_capacity}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {sede.is_active ? (
                                <Badge variant="default">Activa</Badge>
                              ) : (
                                <Badge variant="secondary">Inactiva</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {user?.role === 'admin_global' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditSede(sede)}
                                      title="Editar sede"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleInitializeSedeProducts(sede)}
                                      title="Inicializar productos para esta sede"
                                    >
                                      <Package className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteSede(sede)}
                                      title="Eliminar sede"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {user?.role === 'admin_punto' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditSede(sede)}
                                      title="Editar configuración de sede"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm text-muted-foreground">Solo edición</span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Content: Repartidores */}
          <TabsContent value="repartidores">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle>Gestión de Repartidores</CardTitle>
                      <CardDescription>
                        Administra los repartidores y sus asignaciones de sede
                      </CardDescription>
                    </div>
                    <StatusIndicator {...getLoadingInfo('repartidores')} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => retrySection('repartidores')}
                      disabled={loadingStates.repartidores.isLoading}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingStates.repartidores.isLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </Button>
                    <Button onClick={() => setIsCreateRepartidorOpen(true)} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Agregar Repartidor
                    </Button>
                  </div>
                </div>
                
                <SectionLoading
                  isLoading={loadingStates.repartidores.isLoading}
                  error={loadingStates.repartidores.error}
                  lastUpdated={loadingStates.repartidores.lastUpdated}
                  retryCount={loadingStates.repartidores.retryCount}
                  onRetry={() => retrySection('repartidores')}
                  sectionName="repartidores"
                  className="mt-2"
                />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <Input
                      placeholder="Buscar repartidores..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {filteredRepartidores.length} de {repartidores.length} repartidores
                  </div>
                </div>

                <TableSectionLoading
                  isLoading={loadingStates.repartidores.isLoading}
                  error={loadingStates.repartidores.error}
                  onRetry={() => retrySection('repartidores')}
                  sectionName="repartidores"
                  emptyMessage="No se encontraron repartidores"
                  itemCount={filteredRepartidores.length}
                />

                {!loadingStates.repartidores.isLoading && !loadingStates.repartidores.error && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Repartidor</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Placas</TableHead>
                        <TableHead>Sede</TableHead>
                        <TableHead>Disponibilidad</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRepartidores.map((repartidor) => (
                        <TableRow key={repartidor.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{repartidor.nombre}</div>
                              <div className="text-sm text-muted-foreground">ID: {repartidor.id}</div>
                            </div>
                          </TableCell>
                          <TableCell>{repartidor.telefono}</TableCell>
                          <TableCell>
                            {repartidor.placas ? (
                              <span className="text-sm font-medium">{repartidor.placas}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Sin placas</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {repartidor.sede_id ? (
                              <span className="text-sm text-muted-foreground">
                                {repartidor.sede_name || 'N/A'}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Sin sede</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {repartidor.disponible ? (
                              <Badge variant="default">Disponible</Badge>
                            ) : (
                              <Badge variant="secondary">No Disponible</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleRepartidorStatus(repartidor.id, repartidor.disponible)}
                                title={repartidor.disponible ? 'Desactivar repartidor' : 'Activar repartidor'}
                              >
                                {repartidor.disponible ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              {user?.role !== 'admin_punto' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRepartidorSedeEdit(repartidor)}
                                  title="Cambiar sede del repartidor"
                                >
                                  <Building2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRepartidor(repartidor)
                                  setIsDeleteRepartidorOpen(true)
                                }}
                                title="Eliminar repartidor"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
          </div>
        )}

        {activeSection === 'metrics' && (
          /* ========== SECCIÓN DE MÉTRICAS ========== */
          <div className="space-y-6">
            <MetricsLoading
              isLoading={loadingStates.metrics.isLoading}
              error={loadingStates.metrics.error}
              onRetry={loadMetricsOptimized}
            />

            {!loadingStates.metrics.isLoading && !loadingStates.metrics.error && !metricsData && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">
                    No hay datos disponibles para el rango seleccionado
                  </div>
                </CardContent>
              </Card>
            )}

            {!loadingStates.metrics.isLoading && !loadingStates.metrics.error && metricsData && (
              <div className="space-y-6">
                {/* Controles de Filtros */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="h-5 w-5" />
                          Configuración de Métricas
                        </CardTitle>
                        <CardDescription>
                          Selecciona el rango de fechas y sede para ver las métricas
                        </CardDescription>
                      </div>
                      <StatusIndicator {...getLoadingInfo('metrics')} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div className="flex flex-col gap-2">
                        <Label>Rango de Fechas</Label>
                        
                        {/* Botones de acceso rápido */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              setDateRange({ from: today, to: today });
                            }}
                          >
                            Hoy
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const yesterday = new Date();
                              yesterday.setDate(yesterday.getDate() - 1);
                              setDateRange({ from: yesterday, to: yesterday });
                            }}
                          >
                            Ayer
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              const lastWeek = new Date();
                              lastWeek.setDate(today.getDate() - 7);
                              setDateRange({ from: lastWeek, to: today });
                            }}
                          >
                            Última semana
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              const lastMonth = new Date();
                              lastMonth.setMonth(today.getMonth() - 1);
                              setDateRange({ from: lastMonth, to: today });
                            }}
                          >
                            Último mes
                          </Button>
                        </div>
                        
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(dateRange.from, 'dd/MM/yyyy', { locale: es })}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateRange.from}
                                onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                                disabled={(date) => date < new Date("2020-01-01")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          
                          <span className="flex items-center text-muted-foreground">hasta</span>
                          
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(dateRange.to, 'dd/MM/yyyy', { locale: es })}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateRange.to}
                                onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                                disabled={(date) => date < dateRange.from}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {/* Selector de Sede */}
                      <div className="flex flex-col gap-2">
                        <Label>
                          {user?.role === 'admin_punto' ? 'Sede Asignada' : 'Filtrar por Sede'}
                        </Label>
                        {user?.role === 'admin_punto' ? (
                          // Para admin_punto: mostrar solo su sede asignada (no editable)
                          <div className="w-[200px] px-3 py-2 border rounded-md bg-muted">
                            📍 {user?.sede_name || 'Sede Asignada'}
                          </div>
                        ) : (
                          // Para admin_global: selector completo
                          <Select value={selectedSedeFilter} onValueChange={setSelectedSedeFilter}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Seleccionar sede" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">🌐 Todas las sedes</SelectItem>
                              {sedesSimple.map((sede) => (
                                <SelectItem key={sede.id} value={sede.id}>
                                  📍 {sede.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Bot├│n de Actualizar */}
                      {/* Botón de Actualizar */}
                      <Button 
                        onClick={loadMetricsOptimized}
                        disabled={loadingStates.metrics.isLoading}
                        className="w-[120px]"
                      >
                        {loadingStates.metrics.isLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Actualizar
                      </Button>
                    </div>

                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        📊 Mostrando datos del{' '}
                        <span className="font-medium">{format(dateRange.from, 'dd/MM/yyyy', { locale: es })}</span>
                        {' '}al{' '}
                        <span className="font-medium">{format(dateRange.to, 'dd/MM/yyyy', { locale: es })}</span>
                        {selectedSedeFilter !== 'all' && (
                          <>
                            {' '}para la sede{' '}
                            <span className="font-medium">
                              {sedesSimple.find(s => s.id === selectedSedeFilter)?.name || 'Desconocida'}
                            </span>
                          </>
                        )}
                      </div>
                      {metricsData && (
                        <div className="mt-2 text-sm font-medium">
                          📈 Total: {metricsData.totalGeneral.pedidos} pedidos • 
                          💰 ${metricsData.totalGeneral.ingresos.toLocaleString()} • 
                          📊 Promedio: ${Math.round(metricsData.totalGeneral.promedio).toLocaleString()}/pedido
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Gráficas de métricas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Domicilios por Día */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Domicilios por Día
                        </CardTitle>
                        <CardDescription>
                          Tendencia de domicilios y ganancias diarias
                        </CardDescription>
                      </div>
                      <ExportButton
                        data={metricsData.metricasPorDia}
                        columns={[
                          { key: 'fecha', header: 'Fecha' },
                          { key: 'total_pedidos', header: 'Total Pedidos' },
                          { key: 'total_ingresos', header: 'Total Ingresos', format: formatters.currency },
                          { key: 'promedio_por_pedido', header: 'Promedio por Pedido', format: formatters.currency },
                        ]}
                        filename={`domicilios_por_dia_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}`}
                        formats={['excel', 'csv']}
                      />
                    </CardHeader>
                    <CardContent className="max-h-[300px] overflow-y-auto">
                      <div className="space-y-4 pr-2">
                        {metricsData.metricasPorDia.map((item, index) => {
                          // Parsear fecha como local, no UTC
                          const [year, month, day] = item.fecha.split('-').map(Number);
                          const fechaLocal = new Date(year, month - 1, day);

                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-primary rounded-full"></div>
                                <span className="font-medium">{format(fechaLocal, 'dd/MM', { locale: es })}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-lg">{item.total_pedidos} pedidos</div>
                                <div className="text-sm text-muted-foreground">
                                  ${item.total_ingresos.toLocaleString('es-CO')} ingresos
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {metricsData.metricasPorDia.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No hay datos para el período seleccionado
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Productos Más Vendidos */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Productos Más Vendidos
                        </CardTitle>
                        <CardDescription>
                          Distribución de ventas por producto
                          <div className="mt-1 text-xs">
                            📊 Mostrando datos del <span className="font-medium">{format(dateRange.from, 'dd/MM/yyyy', { locale: es })}</span> al <span className="font-medium">{format(dateRange.to, 'dd/MM/yyyy', { locale: es })}</span>
                          </div>
                        </CardDescription>
                      </div>
                      <ExportButton
                        data={metricsData.productosMasVendidos}
                        columns={[
                          { key: 'producto_nombre', header: 'Producto' },
                          { key: 'total_vendido', header: 'Total Vendido' },
                          { key: 'porcentaje_ventas', header: 'Porcentaje', format: (value) => `${Number(value).toFixed(1)}%` },
                        ]}
                        filename={`productos_mas_vendidos_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}`}
                        formats={['excel', 'csv']}
                      />
                    </CardHeader>
                    <CardContent className="max-h-[300px] overflow-y-auto">
                      <div className="space-y-4 pr-2">
                        {metricsData.productosMasVendidos.slice(0, 5).map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                              ></div>
                              <span className="font-medium">{item.producto_nombre}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{item.total_vendido} vendidos</div>
                              <div className="text-sm text-muted-foreground">{item.porcentaje_ventas.toFixed(1)}%</div>
                            </div>
                          </div>
                        ))}
                        {metricsData.productosMasVendidos.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No hay datos de productos para el período seleccionado
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Métricas de Pedidos Cancelados */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-500" />
                          Análisis de Cancelaciones
                        </CardTitle>
                        <CardDescription>
                          Estadísticas de pedidos cancelados por sede
                        </CardDescription>
                      </div>
                      <ExportButton
                        data={metricsData.pedidosCancelados.porSede}
                        columns={[
                          { key: 'nombre', header: 'Sede' },
                          { key: 'cancelados', header: 'Cancelados' },
                          { key: 'monto', header: 'Monto Perdido', format: formatters.currency },
                        ]}
                        filename={`analisis_cancelaciones_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}`}
                        formats={['excel', 'csv']}
                      />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Resumen de cancelaciones */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {(() => {
                                if (user?.role === 'admin_punto') {
                                  // Para admin_punto: solo mostrar cancelaciones de su sede
                                  const sedeData = metricsData.pedidosCancelados?.porSede?.find(sede => sede.sede_id === user?.sede_id);
                                  return sedeData?.cancelados || 0;
                                }
                                // Para admin_global: mostrar total global
                                return metricsData.pedidosCancelados?.total || 0;
                              })()}
                            </div>
                            <div className="text-sm text-red-700">
                              {user?.role === 'admin_punto' ? 'Cancelados en tu Sede' : 'Total Cancelados'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {(() => {
                                if (user?.role === 'admin_punto') {
                                  // Para admin_punto: calcular porcentaje de su sede vs sus propios pedidos
                                  const sedeData = metricsData.pedidosCancelados?.porSede?.find(sede => sede.sede_id === user?.sede_id);
                                  return sedeData?.porcentaje ? `${sedeData.porcentaje.toFixed(1)}%` : '0.0%';
                                }
                                // Para admin_global: mostrar porcentaje global
                                return metricsData.pedidosCancelados?.porcentaje ? `${metricsData.pedidosCancelados.porcentaje.toFixed(1)}%` : '0.0%';
                              })()}
                            </div>
                            <div className="text-sm text-red-700">Tasa de Cancelación</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {(() => {
                                if (user?.role === 'admin_punto') {
                                  // Para admin_punto: calcular monto de su sede
                                  const sedeData = metricsData.pedidosCancelados?.porSede?.find(sede => sede.sede_id === user?.sede_id);
                                  return `$${((sedeData?.monto || 0) / 1000).toFixed(0)}k`;
                                }
                                // Para admin_global: mostrar monto global
                                return `$${((metricsData.pedidosCancelados?.montoTotal || 0) / 1000).toFixed(0)}k`;
                              })()}
                            </div>
                            <div className="text-sm text-red-700">Monto Perdido</div>
                          </div>
                        </div>

                        {/* Cancelaciones por sede */}
                        {metricsData.pedidosCancelados?.porSede && metricsData.pedidosCancelados.porSede.length > 0 ? (
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            <h4 className="font-semibold text-sm">
                              {user?.role === 'admin_punto' ? 'Cancelaciones en tu Sede:' : 'Cancelaciones por Sede:'}
                            </h4>
                            {metricsData.pedidosCancelados.porSede
                              .filter(sede => {
                                // Filtrar por rol
                                if (user?.role !== 'admin_global' && sede.sede_id !== user?.sede_id) {
                                  return false;
                                }
                                // Filtrar por sede seleccionada (solo para admin_global)
                                if (user?.role === 'admin_global' && selectedSedeFilter !== 'all' && sede.sede_id !== selectedSedeFilter) {
                                  return false;
                                }
                                return true;
                              })
                              .map((sede, index) => (
                              <div 
                                key={index} 
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-red-100 cursor-pointer transition-colors border-l-4 border-red-500"
                                onClick={() => handleShowCancelledOrders(sede.sede_id, sede.nombre)}
                                title="Click para ver detalles de las órdenes canceladas"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                  <span className="font-medium">{sede.nombre}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-red-600">{sede.cancelados}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {user?.role === 'admin_punto'
                                      ? `${sede.cancelados} cancelaciones`
                                      : `${sede.porcentaje ? sede.porcentaje.toFixed(1) : '0'}% del total`
                                    }
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No hay cancelaciones en el período seleccionado</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                </div>
              </div>
            )}

            {/* Métricas de Rendimiento de Repartidores */}
            <DeliveryPersonMetrics
              filters={{
                fecha_inicio: format(dateRange.from, 'yyyy-MM-dd'),
                fecha_fin: format(dateRange.to, 'yyyy-MM-dd'),
                sede_id: selectedSedeFilter === 'all' ? undefined : selectedSedeFilter
              }}
              onNavigateToTimeMetrics={onNavigateToTimeMetrics}
            />

            {/* Métricas de Descuentos */}
            <DiscountMetrics
              sedeId={selectedSedeFilter === 'all' ? undefined : selectedSedeFilter}
              startDate={format(dateRange.from, 'yyyy-MM-dd')}
              endDate={format(dateRange.to, 'yyyy-MM-dd')}
              className="lg:col-span-2"
            />
          </div>
        )}

        {activeSection === 'crm' && (
          /* ========== SECCIÓN DE CRM ========== */
          <div className="space-y-6">
            <CRM effectiveSedeId={selectedSedeFilter === 'all' ? undefined : selectedSedeFilter} />
          </div>
        )}

        {activeSection === 'orderStates' && (
          /* ========== SECCIÓN DE ESTADOS DE ÓRDENES ========== */
          <div className="space-y-6">
            <OrderStatesStatsPanel
              filters={{
                fecha_inicio: format(dateRange.from, 'yyyy-MM-dd'),
                fecha_fin: format(dateRange.to, 'yyyy-MM-dd'),
                sede_id: selectedSedeFilter === 'all' ? undefined : selectedSedeFilter
              }}
            />
          </div>
        )}

        
        <Dialog open={isEditSedeOpen} onOpenChange={setIsEditSedeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Sede</DialogTitle>
              <DialogDescription>
                Modifica la información de la sede
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSede} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-sede-name">Nombre</Label>
                <Input
                  id="edit-sede-name"
                  value={sedeFormData.name}
                  onChange={(e) => setSedeFormData({ ...sedeFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sede-address">Dirección</Label>
                <Input
                  id="edit-sede-address"
                  value={sedeFormData.address}
                  onChange={(e) => setSedeFormData({ ...sedeFormData, address: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sede-phone">Teléfono</Label>
                <Input
                  id="edit-sede-phone"
                  type="tel"
                  value={sedeFormData.phone}
                  onChange={(e) => setSedeFormData({ ...sedeFormData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-sede-active"
                  checked={sedeFormData.is_active}
                  onCheckedChange={(checked) => setSedeFormData({ ...sedeFormData, is_active: checked })}
                />
                <Label htmlFor="edit-sede-active">Sede activa</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditSedeOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Actualizar Sede</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal para Reasignar Sede de Usuario */}
        <Dialog open={isUserSedeEditOpen} onOpenChange={setIsUserSedeEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reasignar Sede de Usuario</DialogTitle>
              <DialogDescription>
                Cambia la sede asignada a {selectedUser?.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateUserSede} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-sede-select">Nueva Sede</Label>
                <Select value={userSedeFormData.sede_id} onValueChange={(value) => setUserSedeFormData({ sede_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedesSimple.map((sede) => (
                      <SelectItem key={sede.id} value={sede.id}>
                        {sede.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsUserSedeEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Building2 className="mr-2 h-4 w-4" />
                  Actualizar Sede
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal para Reasignar Sede de Repartidor */}
        <Dialog open={isRepartidorSedeEditOpen} onOpenChange={setIsRepartidorSedeEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reasignar Sede de Repartidor</DialogTitle>
              <DialogDescription>
                Cambia la sede asignada a {selectedRepartidor?.nombre}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateRepartidorSede} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repartidor-sede-select">Nueva Sede</Label>
                <Select value={repartidorSedeFormData.sede_id} onValueChange={(value) => setRepartidorSedeFormData({ sede_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin sede</SelectItem>
                    {sedesSimple.map((sede) => (
                      <SelectItem key={sede.id} value={sede.id}>
                        {sede.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsRepartidorSedeEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Truck className="mr-2 h-4 w-4" />
                  Actualizar Sede
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal para Crear Repartidor */}
        <Dialog open={isCreateRepartidorOpen} onOpenChange={setIsCreateRepartidorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Repartidor</DialogTitle>
              <DialogDescription>
                Agrega un nuevo repartidor al sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRepartidor} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repartidor-nombre">Nombre *</Label>
                <Input
                  id="repartidor-nombre"
                  value={repartidorFormData.nombre}
                  onChange={(e) => setRepartidorFormData({ ...repartidorFormData, nombre: e.target.value })}
                  placeholder="Nombre completo del repartidor"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repartidor-telefono">Tel├®fono *</Label>
                <Label htmlFor="repartidor-telefono">Teléfono *</Label>
                <Input
                  id="repartidor-telefono"
                  value={repartidorFormData.telefono}
                  onChange={(e) => setRepartidorFormData({ ...repartidorFormData, telefono: e.target.value })}
                  placeholder="Número de teléfono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repartidor-placas">Placas (opcional)</Label>
                <Input
                  id="repartidor-placas"
                  value={repartidorFormData.placas}
                  onChange={(e) => setRepartidorFormData({ ...repartidorFormData, placas: e.target.value })}
                  placeholder="Placas del vehículo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repartidor-sede">
                  {user?.role === 'admin_punto' ? 'Sede Asignada' : 'Sede (opcional)'}
                </Label>
                {user?.role === 'admin_punto' ? (
                  // Para admin_punto: mostrar su sede asignada (no editable)
                  <div className="px-3 py-2 border rounded-md bg-muted">
                    📍 {user?.sede_name || 'Sede Asignada'}
                  </div>
                ) : (
                  // Para admin_global: selector normal
                  <Select value={repartidorFormData.sede_id} onValueChange={(value) => setRepartidorFormData({ ...repartidorFormData, sede_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sede" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin sede</SelectItem>
                      {sedesSimple.map((sede) => (
                        <SelectItem key={sede.id} value={sede.id}>
                          {sede.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateRepartidorOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Repartidor
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal para Eliminar Repartidor */}
        <Dialog open={isDeleteRepartidorOpen} onOpenChange={setIsDeleteRepartidorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar Repartidor</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres eliminar al repartidor <strong>{selectedRepartidor?.nombre}</strong>?
                <br />
                <span className="text-sm text-muted-foreground">
                  Esta acción no se puede deshacer. Si el repartidor tiene órdenes activas, no se podrá eliminar.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDeleteRepartidorOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDeleteRepartidor}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Repartidor
              </Button>
            </div>
          </DialogContent>
        </Dialog>


      </div>
      
      {/* Cancelled Orders Modal */}
      {selectedSedeForCancelled && (
        <CancelledOrdersModal
          isOpen={isCancelledOrdersModalOpen}
          onClose={() => {
            setIsCancelledOrdersModalOpen(false);
            setSelectedSedeForCancelled(null);
          }}
          sedeId={selectedSedeForCancelled.id}
          sedeNombre={selectedSedeForCancelled.nombre}
          dateFilters={{
            fecha_inicio: format(dateRange.from, 'yyyy-MM-dd'),
            fecha_fin: format(dateRange.to, 'yyyy-MM-dd')
          }}
        />
      )}
    </div>
  )
}
