import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Users, Building2, UserCheck, UserX, TrendingUp, DollarSign, Package, Clock, LayoutDashboard, Phone, MapPin, Settings, RefreshCw, Cog, ChartLine, Timer, BarChart3, Truck, XCircle, Eye, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { adminService, CreateUserData, User, CreateSedeData, UpdateSedeData, Sede, Repartidor } from '@/services/adminService'
import { metricsService, DashboardMetrics, MetricsFilters } from '@/services/metricsService'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'


type Profile = User


interface AdminPanelProps {
  onBack?: () => void;
  onNavigateToTimeMetrics?: () => void;
}

export function AdminPanel({ onBack, onNavigateToTimeMetrics }: AdminPanelProps) {
  const [users, setUsers] = useState<Profile[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedesSimple, setSedesSimple] = useState<Array<{ id: string; name: string }>>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [selectedRepartidor, setSelectedRepartidor] = useState<Repartidor | null>(null)
  const [isRepartidorSedeEditOpen, setIsRepartidorSedeEditOpen] = useState(false)
  const [repartidorSedeFormData, setRepartidorSedeFormData] = useState({ sede_id: '' })
  const [isCreateRepartidorOpen, setIsCreateRepartidorOpen] = useState(false)
  const [isDeleteRepartidorOpen, setIsDeleteRepartidorOpen] = useState(false)
  const [repartidorFormData, setRepartidorFormData] = useState({
    nombre: '',
    telefono: '',
    placas: '',
    sede_id: ''
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [isCreateSedeOpen, setIsCreateSedeOpen] = useState(false)
  const [isEditSedeOpen, setIsEditSedeOpen] = useState(false)
  const [isUserSedeEditOpen, setIsUserSedeEditOpen] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [selectedSede, setSelectedSede] = useState<Sede | null>(null)
  const [userSedeFormData, setUserSedeFormData] = useState({ sede_id: '' })
  const [showMainApp, setShowMainApp] = useState(false)
  const { activeTab, setActiveTab, resetToUsers } = useAdminTab()
  const { activeSection, setActiveSection } = useAdminSection()

  const { toast } = useToast()
  const { signOut } = useAuth()

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent' as 'admin' | 'agent',
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
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSedeFilter, setSelectedSedeFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(), // Hoy por defecto
    to: new Date()    // Hoy por defecto
  })

  // Estados para pedidos cancelados
  const [canceledOrdersData, setCanceledOrdersData] = useState<{
    total: number;
    porSede: Array<{ sede: string; count: number; sede_id: string }>;
  } | null>(null)
  const [showCanceledModal, setShowCanceledModal] = useState(false)
  const [canceledOrdersList, setCanceledOrdersList] = useState<Array<{
    id_display: string;
    cliente_nombre: string;
    sede: string;
    motivo_cancelacion: string;
    cancelado_at: string;
    total: number;
  }>>([])
  const [loadingCanceled, setLoadingCanceled] = useState(false)

  // Estados para modal de detalles de cancelados por sede
  const [canceledDetailsModalOpen, setCanceledDetailsModalOpen] = useState(false)
  const [selectedSedeDetails, setSelectedSedeDetails] = useState<{
    sede_id: string;
    sede_nombre: string;
  } | null>(null)
  const [canceledOrdersDetails, setCanceledOrdersDetails] = useState<Array<{
    id: string;
    id_display: string;
    cliente_nombre: string;
    cliente_telefono: string;
    cliente_direccion: string;
    total: number;
    motivo_cancelacion: string;
    created_at: string;
    cancelado_at: string;
  }>>([])
  const [canceledDetailsLoading, setCanceledDetailsLoading] = useState(false)
  const [canceledSearchTerm, setCanceledSearchTerm] = useState('')
  const [canceledCurrentPage, setCanceledCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Estados derivados para la UI de cancelados
  const canceledStats = canceledOrdersData ? Array.from({ length: canceledOrdersData.total }, (_, i) => ({ id: i })) : []
  const canceledBySede = canceledOrdersData?.porSede.map(sede => ({
    sede_id: sede.sede_id,
    sede_nombre: sede.sede,
    count: sede.count
  })).sort((a, b) => b.count - a.count) || []

  // Filtrar y paginar datos de cancelados para modal
  const filteredCanceledOrders = canceledOrdersDetails.filter(order => {
    const searchLower = canceledSearchTerm.toLowerCase()
    return (
      order.id_display.toLowerCase().includes(searchLower) ||
      order.cliente_nombre.toLowerCase().includes(searchLower) ||
      order.cliente_telefono.includes(canceledSearchTerm) ||
      order.motivo_cancelacion.toLowerCase().includes(searchLower)
    )
  })

  const totalCanceledPages = Math.ceil(filteredCanceledOrders.length / itemsPerPage)
  const paginatedCanceledOrders = filteredCanceledOrders.slice(
    (canceledCurrentPage - 1) * itemsPerPage,
    canceledCurrentPage * itemsPerPage
  )

  useEffect(() => {
    console.log('🚀 AdminPanel iniciando...')
    fetchUsers()
    fetchSedes()
    fetchSedesComplete()
    fetchRepartidores()
    loadCanceledOrdersStats() // Cargar estadísticas de cancelados
    // loadMetrics() se ejecutará por el otro useEffect
  }, [])

  // Recargar métricas cuando cambien los filtros - solo si dateRange está inicializado
  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      console.log('🔄 Recargando métricas por cambio de filtros...');
      loadMetrics();
      loadCanceledOrdersStats(); // También recargar estadísticas de cancelados
    }
  }, [dateRange, selectedSedeFilter])

  const fetchUsers = async () => {
    try {
      console.log('🔍 Intentando obtener usuarios...')
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          sedes(name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error obteniendo usuarios:', error)
        throw error
      }
      
      console.log('✅ Usuarios obtenidos:', data?.length || 0)
      setUsers(data || [])
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchSedes = async () => {
    try {
      console.log('🔍 Intentando obtener sedes simples...')
      
      const sedesData = await adminService.getSedes()
      setSedesSimple(sedesData)
      console.log('✅ Sedes simples obtenidas:', sedesData.length)
    } catch (error) {
      console.error('❌ Error fetching sedes:', error)
    }
  }

  const fetchSedesComplete = async () => {
    try {
      console.log('🔍 Intentando obtener sedes completas...')
      
      const sedesData = await adminService.getSedesComplete()
      setSedes(sedesData)
      console.log('✅ Sedes completas obtenidas:', sedesData.length)
    } catch (error) {
      console.error('❌ Error fetching sedes completas:', error)
    }
  }

  const loadMetrics = async () => {
    try {
      setMetricsLoading(true)
      console.log('📊 Cargando métricas...')
      console.log('🔍 DEBUG dateRange:', {
        from: dateRange.from,
        to: dateRange.to,
        from_iso: dateRange.from.toISOString(),
        to_iso: dateRange.to.toISOString()
      })

      const filters: MetricsFilters = {
        fecha_inicio: format(dateRange.from, 'yyyy-MM-dd'),
        fecha_fin: format(dateRange.to, 'yyyy-MM-dd'),
        sede_id: selectedSedeFilter === 'all' ? undefined : selectedSedeFilter
      }

      console.log('🔍 DEBUG AdminPanel - Filtros aplicados:', {
        fecha_inicio: filters.fecha_inicio,
        fecha_fin: filters.fecha_fin,
        sede_id: filters.sede_id,
        dateRange_from: dateRange.from,
        dateRange_to: dateRange.to,
        selectedSedeFilter: selectedSedeFilter
      })

      const metrics = await metricsService.getDashboardMetrics(filters)
      setMetricsData(metrics)
      console.log('✅ Métricas cargadas exitosamente:', {
        metricasPorDia: metrics.metricasPorDia?.length || 0,
        totalPedidos: metrics.totalGeneral?.pedidos || 0,
        totalIngresos: metrics.totalGeneral?.ingresos || 0,
        promedio: metrics.totalGeneral?.promedio || 0,
        rawMetrics: JSON.stringify(metrics, null, 2)
      })
    } catch (error) {
      console.error('❌ Error cargando métricas:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las métricas",
        variant: "destructive",
      })
    } finally {
      setMetricsLoading(false)
    }
  }

  // Función para cargar estadísticas de pedidos cancelados con filtros de fecha
  const loadCanceledOrdersStats = async () => {
    try {
      console.log('📊 Cargando estadísticas de pedidos cancelados...')
      
      // Construir query con filtros de fecha
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          status,
          sede_id,
          created_at,
          sedes!left(name)
        `)
        .eq('status', 'Cancelado')
        .order('created_at', { ascending: false })

      // Aplicar filtros de fecha si están definidos
      if (dateRange.from && dateRange.to) {
        const fechaInicio = format(dateRange.from, 'yyyy-MM-dd')
        const fechaFin = format(dateRange.to, 'yyyy-MM-dd')
        
        query = query
          .gte('created_at', `${fechaInicio}T00:00:00Z`)
          .lte('created_at', `${fechaFin}T23:59:59Z`)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error cargando estadísticas cancelados:', error)
        return
      }

      // Agrupar por sede
      const porSede = data?.reduce((acc: any[], orden: any) => {
        const sede = orden.sedes?.name || 'Sin sede'
        const sede_id = orden.sede_id || 'sin-sede'
        
        const existing = acc.find(item => item.sede_id === sede_id)
        if (existing) {
          existing.count++
        } else {
          acc.push({
            sede,
            sede_id,
            count: 1
          })
        }
        return acc
      }, []) || []

      setCanceledOrdersData({
        total: data?.length || 0,
        porSede: porSede
      })

      console.log('✅ Estadísticas de cancelados cargadas:', {
        total: data?.length || 0,
        porSede: porSede.length
      })
    } catch (error) {
      console.error('❌ Error inesperado cargando cancelados:', error)
    }
  }

  // Función para cargar lista detallada de pedidos cancelados por sede
  const loadCanceledOrdersBySede = async (sedeId?: string) => {
    try {
      setLoadingCanceled(true)
      console.log('📋 Cargando pedidos cancelados por sede:', sedeId)
      
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          status,
          motivo_cancelacion,
          cancelado_at,
          created_at,
          clientes!left(nombre),
          sedes!left(name),
          pagos!left(total_pago)
        `)
        .eq('status', 'Cancelado')
        .order('cancelado_at', { ascending: false })

      // Filtrar por sede si se proporciona
      if (sedeId && sedeId !== 'all') {
        query = query.eq('sede_id', sedeId)
      }

      // Aplicar filtros de fecha
      if (dateRange.from && dateRange.to) {
        const fechaInicio = format(dateRange.from, 'yyyy-MM-dd')
        const fechaFin = format(dateRange.to, 'yyyy-MM-dd')
        
        query = query
          .gte('created_at', `${fechaInicio}T00:00:00Z`)
          .lte('created_at', `${fechaFin}T23:59:59Z`)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error cargando lista cancelados por sede:', error)
        toast({
          title: "Error",
          description: "No se pudo cargar la lista de pedidos cancelados",
          variant: "destructive"
        })
        return
      }

      const formattedList = data?.map(orden => ({
        id_display: `ORD-${orden.id.toString().padStart(4, '0')}`,
        cliente_nombre: orden.clientes?.nombre || 'Cliente desconocido',
        sede: orden.sedes?.name || 'Sin sede',
        motivo_cancelacion: orden.motivo_cancelacion || 'No especificado',
        cancelado_at: orden.cancelado_at || '',
        total: orden.pagos?.total_pago || 0
      })) || []

      setCanceledOrdersList(formattedList)
      setShowCanceledModal(true)

      console.log('✅ Lista de cancelados por sede cargada:', formattedList.length)
    } catch (error) {
      console.error('❌ Error inesperado cargando lista por sede:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar la lista",
        variant: "destructive"
      })
    } finally {
      setLoadingCanceled(false)
    }
  }

  // Función para cargar lista detallada de pedidos cancelados
  const loadCanceledOrdersList = async () => {
    try {
      setLoadingCanceled(true)
      console.log('📋 Cargando lista detallada de pedidos cancelados...')
      
      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          status,
          motivo_cancelacion,
          cancelado_at,
          clientes!left(nombre),
          sedes!left(name),
          pagos!left(total_pago)
        `)
        .eq('status', 'Cancelado')
        .order('cancelado_at', { ascending: false })

      if (error) {
        console.error('❌ Error cargando lista cancelados:', error)
        toast({
          title: "Error",
          description: "No se pudo cargar la lista de pedidos cancelados",
          variant: "destructive"
        })
        return
      }

      const formattedList = data?.map(orden => ({
        id_display: `ORD-${orden.id.toString().padStart(4, '0')}`,
        cliente_nombre: orden.clientes?.nombre || 'Cliente desconocido',
        sede: orden.sedes?.name || 'Sin sede',
        motivo_cancelacion: orden.motivo_cancelacion || 'No especificado',
        cancelado_at: orden.cancelado_at || '',
        total: orden.pagos?.total_pago || 0
      })) || []

      setCanceledOrdersList(formattedList)
      setShowCanceledModal(true)

      console.log('✅ Lista de cancelados cargada:', formattedList.length)
    } catch (error) {
      console.error('❌ Error inesperado cargando lista:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar la lista",
        variant: "destructive"
      })
    } finally {
      setLoadingCanceled(false)
    }
  }

  // Función para cargar detalles completos de pedidos cancelados por sede
  const loadCanceledOrdersDetailsBySede = async (sedeId: string, sedeName: string) => {
    try {
      setCanceledDetailsLoading(true)
      console.log('📋 Cargando detalles de pedidos cancelados para sede:', sedeName)
      
      let query = supabase
        .from('ordenes')
        .select(`
          id,
          status,
          motivo_cancelacion,
          cancelado_at,
          created_at,
          clientes!inner(nombre, telefono, direccion),
          pagos!left(total_pago),
          sedes!left(name)
        `)
        .eq('status', 'Cancelado')
        .order('created_at', { ascending: false })

      // Filtrar por sede
      if (sedeId !== 'sin-sede') {
        query = query.eq('sede_id', sedeId)
      } else {
        query = query.is('sede_id', null)
      }

      // Aplicar filtros de fecha
      if (dateRange.from && dateRange.to) {
        const fechaInicio = format(dateRange.from, 'yyyy-MM-dd')
        const fechaFin = format(dateRange.to, 'yyyy-MM-dd')
        
        query = query
          .gte('created_at', `${fechaInicio}T00:00:00Z`)
          .lte('created_at', `${fechaFin}T23:59:59Z`)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error cargando detalles cancelados por sede:', error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los detalles de pedidos cancelados",
          variant: "destructive"
        })
        return
      }

      const formattedDetails = data?.map(orden => ({
        id: orden.id.toString(),
        id_display: `ORD-${orden.id.toString().padStart(4, '0')}`,
        cliente_nombre: orden.clientes?.nombre || 'Cliente desconocido',
        cliente_telefono: orden.clientes?.telefono || 'No especificado',
        cliente_direccion: orden.clientes?.direccion || 'No especificada',
        total: orden.pagos?.total_pago || 0,
        motivo_cancelacion: orden.motivo_cancelacion || 'No especificado',
        created_at: orden.created_at || '',
        cancelado_at: orden.cancelado_at || ''
      })) || []

      setCanceledOrdersDetails(formattedDetails)
      setSelectedSedeDetails({ sede_id: sedeId, sede_nombre: sedeName })
      setCanceledDetailsModalOpen(true)
      setCanceledCurrentPage(1) // Reset pagination
      setCanceledSearchTerm('') // Reset search

      console.log('✅ Detalles de cancelados por sede cargados:', formattedDetails.length)
    } catch (error) {
      console.error('❌ Error inesperado cargando detalles por sede:', error)
      toast({
        title: "Error",
        description: "Error inesperado al cargar los detalles",
        variant: "destructive"
      })
    } finally {
      setCanceledDetailsLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsCreatingUser(true)
      console.log('➕ Creando usuario con nuevo servicio...')
      
      // Usar el nuevo servicio para crear el perfil de usuario
      const userData: CreateUserData = {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role,
        sede_id: formData.sede_id || undefined,
        is_active: formData.is_active
      }

      const newUser = await adminService.createUser(userData)

      toast({
        title: "Usuario creado exitosamente",
        description: `${formData.name} ha sido creado y puede iniciar sesión inmediatamente con: ${formData.email}`,
      })

      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'agent',
        sede_id: '',
        is_active: true
      })
      setIsCreateUserOpen(false)
      fetchUsers()
    } catch (error: any) {
      console.error('Error creating user:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el perfil de usuario",
        variant: "destructive",
      })
    } finally {
      setIsCreatingUser(false)
    }
  }

  const handleUserSedeEdit = (user: Profile) => {
    setSelectedUser(user)
    setUserSedeFormData({ sede_id: user.sede_id || '' })
    setIsUserSedeEditOpen(true)
  }

  const handleUpdateUserSede = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUser) return
    
    try {
      await adminService.updateUserSede(selectedUser.id, userSedeFormData.sede_id)
      
      toast({
        title: "Sede actualizada",
        description: `La sede de ${selectedUser.name} ha sido actualizada exitosamente.`,
      })
      
      setIsUserSedeEditOpen(false)
      setSelectedUser(null)
      setUserSedeFormData({ sede_id: '' })
      fetchUsers()
    } catch (error: any) {
      console.error('Error updating user sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la sede del usuario",
        variant: "destructive",
      })
    }
  }

  const handleCreateSede = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      console.log('➕ Creando sede...')
      
      const sedeData: CreateSedeData = {
        name: sedeFormData.name,
        address: sedeFormData.address,
        phone: sedeFormData.phone,
        is_active: sedeFormData.is_active
      }

      const newSede = await adminService.createSede(sedeData)

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
      fetchSedesComplete()
      fetchSedes()
    } catch (error: any) {
      console.error('Error creating sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la sede",
        variant: "destructive",
      })
    }
  }

  const handleEditSede = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedSede) return

    try {
      console.log('✏️ Editando sede...')
      
      const updateData: UpdateSedeData = {
        name: sedeFormData.name,
        address: sedeFormData.address,
        phone: sedeFormData.phone,
        is_active: sedeFormData.is_active
      }

      await adminService.updateSede(selectedSede.id, updateData)

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
      fetchSedesComplete()
      fetchSedes()
    } catch (error: any) {
      console.error('Error updating sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la sede",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSede = async (sede: Sede) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la sede "${sede.name}"?`)) {
      return
    }

    try {
      console.log('🗑️ Eliminando sede...')
      
      await adminService.deleteSede(sede.id)

      toast({
        title: "Sede eliminada",
        description: `La sede ${sede.name} ha sido eliminada exitosamente`,
      })

      fetchSedesComplete()
      fetchSedes()
    } catch (error: any) {
      console.error('Error deleting sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la sede",
        variant: "destructive",
      })
    }
  }

  const openEditSede = (sede: Sede) => {
    setSelectedSede(sede)
    setSedeFormData({
      name: sede.name,
      address: sede.address,
      phone: sede.phone,
      is_active: sede.is_active
    })
    setIsEditSedeOpen(true)
  }

  const handleInitializeSedeProducts = async (sede: Sede) => {
    if (!confirm(`¿Inicializar productos para la sede "${sede.name}"?\n\nEsto creará registros de productos, bebidas y toppings con disponibilidad activada.`)) {
      return
    }

    try {
      console.log('🔄 Inicializando productos para sede:', sede.name, sede.id)
      
      await adminService.initializeExistingSedeProducts(sede.id)

      toast({
        title: "Productos inicializados",
        description: `Productos inicializados exitosamente para la sede "${sede.name}"`,
      })

      // Recargar la lista (opcional)
      await fetchSedes()
      
    } catch (error: any) {
      console.error('Error initializing sede products:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudieron inicializar los productos para la sede",
        variant: "destructive",
      })
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await adminService.updateUserStatus(userId, !currentStatus)

      toast({
        title: currentStatus ? "Usuario desactivado" : "Usuario activado",
        description: `El usuario ha sido ${currentStatus ? 'desactivado' : 'activado'} exitosamente`,
      })

      fetchUsers()
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async (userId: string, userName: string, userEmail: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el usuario "${userName}" (${userEmail})? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      await adminService.deleteUser(userId)
      
      toast({
        title: "Usuario eliminado",
        description: `El usuario ${userName} ha sido eliminado exitosamente`,
      })

      fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive",
      })
    }
  }

  // ======= FUNCIONES PARA REPARTIDORES =======

  const fetchRepartidores = async () => {
    try {
      console.log('🔍 Intentando obtener repartidores...')
      const repartidoresData = await adminService.getRepartidores()
      setRepartidores(repartidoresData)
      console.log('✅ Repartidores obtenidos:', repartidoresData.length)
    } catch (error) {
      console.error('❌ Error fetching repartidores:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los repartidores",
        variant: "destructive",
      })
    }
  }

  const handleRepartidorSedeEdit = (repartidor: Repartidor) => {
    setSelectedRepartidor(repartidor)
    setRepartidorSedeFormData({ sede_id: repartidor.sede_id || '' })
    setIsRepartidorSedeEditOpen(true)
  }

  const handleUpdateRepartidorSede = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedRepartidor) return
    
    try {
      await adminService.updateRepartidorSede(
        selectedRepartidor.id, 
        repartidorSedeFormData.sede_id || null
      )
      
      toast({
        title: "Sede actualizada",
        description: `La sede del repartidor ${selectedRepartidor.nombre} ha sido actualizada exitosamente`,
      })
      
      setIsRepartidorSedeEditOpen(false)
      setSelectedRepartidor(null)
      setRepartidorSedeFormData({ sede_id: '' })
      fetchRepartidores()
    } catch (error: any) {
      console.error('Error updating repartidor sede:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la sede del repartidor",
        variant: "destructive",
      })
    }
  }

  const toggleRepartidorStatus = async (repartidorId: number, currentStatus: boolean) => {
    try {
      await adminService.updateRepartidorStatus(repartidorId, !currentStatus)

      toast({
        title: currentStatus ? "Repartidor desactivado" : "Repartidor activado",
        description: `El repartidor ha sido ${currentStatus ? 'desactivado' : 'activado'} exitosamente`,
      })

      fetchRepartidores()
    } catch (error: any) {
      console.error('Error updating repartidor:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el repartidor",
        variant: "destructive",
      })
    }
  }

  const handleCreateRepartidor = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!repartidorFormData.nombre.trim() || !repartidorFormData.telefono.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios (nombre y teléfono)",
        variant: "destructive",
      })
      return
    }

    try {
      await adminService.createRepartidor({
        nombre: repartidorFormData.nombre.trim(),
        telefono: repartidorFormData.telefono.trim(),
        placas: repartidorFormData.placas.trim() || undefined,
        sede_id: repartidorFormData.sede_id || null
      })

      toast({
        title: "Repartidor creado",
        description: `El repartidor ${repartidorFormData.nombre} ha sido creado exitosamente`,
      })

      setIsCreateRepartidorOpen(false)
      setRepartidorFormData({
        nombre: '',
        telefono: '',
        placas: '',
        sede_id: ''
      })
      fetchRepartidores()
    } catch (error: any) {
      console.error('Error creating repartidor:', error)
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
      await adminService.deleteRepartidor(selectedRepartidor.id)

      toast({
        title: "Repartidor eliminado",
        description: `El repartidor ${selectedRepartidor.nombre} ha sido eliminado exitosamente`,
      })

      setIsDeleteRepartidorOpen(false)
      setSelectedRepartidor(null)
      fetchRepartidores()
    } catch (error: any) {
      console.error('Error deleting repartidor:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el repartidor",
        variant: "destructive",
      })
    }
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredRepartidores = repartidores.filter(repartidor =>
    repartidor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repartidor.telefono.includes(searchTerm) ||
    (repartidor.placas && repartidor.placas.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Administrador</Badge>
      case 'agent':
        return <Badge variant="secondary">Agente</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  console.log('🎨 Renderizando AdminPanel, loading:', loading, 'users:', users.length)

  // Si showMainApp es true, mostrar la aplicación principal
  if (showMainApp) {
    return (
      <div className="min-h-screen bg-background">
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
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
        
        {/* Aquí iría el contenido de la aplicación principal */}
        <div className="p-6">
          <div className="text-center py-12">
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
        </div>

        {activeSection === 'config' ? (
          /* ========== SECCIÓN DE CONFIGURACIONES ========== */
          <div className="space-y-6">
            {/* Stats Cards de Configuración */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {users.filter(u => u.is_active).length} activos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sedes</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sedes.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Todas activas
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
                    {users.filter(u => u.role === 'admin' && u.is_active).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usuarios con permisos de administrador
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={loadCanceledOrdersList}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pedidos Cancelados</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {canceledOrdersData?.total || 0}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Click para ver detalles
                    </div>
                    {canceledOrdersData && canceledOrdersData.porSede.length > 0 && (
                      <div className="text-xs">
                        {canceledOrdersData.porSede.slice(0, 2).map(sede => (
                          <div key={sede.sede_id} className="text-red-600">
                            {sede.sede}: {sede.count}
                          </div>
                        ))}
                        {canceledOrdersData.porSede.length > 2 && (
                          <div className="text-gray-500">
                            +{canceledOrdersData.porSede.length - 2} más...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
              Sedes
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
                  <div>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>
                      Administra los usuarios del sistema
                    </CardDescription>
                  </div>
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
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
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
                        onValueChange={(value: 'admin' | 'agent') => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">Agente</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sede">Sede (Opcional)</Label>
                      <Select
                        value={formData.sede_id}
                        onValueChange={(value) => setFormData({ ...formData, sede_id: value })}
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
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Cargando usuarios...</p>
                </div>
              ) : (
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
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          {user.sede_id ? (
                            <span className="text-sm text-muted-foreground">
                              {sedesSimple.find(s => s.id === user.sede_id)?.name || 'N/A'}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin sede</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.is_active ? (
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
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              title={user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                            >
                              {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUserSedeEdit(user)}
                              title="Editar sede del usuario"
                            >
                              <Building2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.name, user.email)}
                              title="Eliminar usuario"
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
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Tab Content: Sedes */}
          <TabsContent value="sedes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Sedes</CardTitle>
                    <CardDescription>
                      Administra las sedes del sistema
                    </CardDescription>
                  </div>
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
                        <DialogDescription>
                          Completa la información de la nueva sede
                        </DialogDescription>
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
                          <Button type="button" variant="outline" onClick={() => setIsCreateSedeOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit">Crear Sede</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Search bar for sedes */}
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar sedes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground">Cargando sedes...</div>
                    </div>
                  ) : (
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
                          .filter(sede => 
                            sede.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            sede.address.toLowerCase().includes(searchTerm.toLowerCase())
                          )
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
                  <div>
                    <CardTitle>Gestión de Repartidores</CardTitle>
                    <CardDescription>
                      Administra los repartidores y sus asignaciones de sede
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsCreateRepartidorOpen(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Agregar Repartidor
                  </Button>
                </div>
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

                {loading ? (
                  <div className="text-center py-4">Cargando repartidores...</div>
                ) : (
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRepartidorSedeEdit(repartidor)}
                                title="Cambiar sede del repartidor"
                              >
                                <Building2 className="h-4 w-4" />
                              </Button>
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
        ) : (
          /* ========== SECCIÓN DE MÉTRICAS ========== */
          <div className="space-y-6">
            {/* Métricas de Negocio */}
            {metricsLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Cargando métricas...
                  </div>
                </CardContent>
              </Card>
            ) : !metricsData ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">
                    No hay datos disponibles para el rango seleccionado
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Controles de Filtros */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Configuración de Métricas
                    </CardTitle>
                    <CardDescription>
                      Selecciona el rango de fechas y sede para ver las métricas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      {/* Selector de Rango de Fechas */}
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
                        <Label>Filtrar por Sede</Label>
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
                      </div>

                      {/* Botón de Actualizar */}
                      <Button 
                        onClick={loadMetrics} 
                        disabled={metricsLoading}
                        className="w-[120px]"
                      >
                        {metricsLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Actualizar
                      </Button>
                    </div>

                    {/* Resumen de filtros aplicados */}
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
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Domicilios por Día
                      </CardTitle>
                      <CardDescription>
                        Tendencia de domicilios y ganancias diarias
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {metricsData.metricasPorDia.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-primary rounded-full"></div>
                              <span className="font-medium">{format(new Date(item.fecha), 'dd/MM', { locale: es })}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg">{item.total_pedidos} pedidos</div>
                              <div className="text-sm text-muted-foreground">
                                ${(item.total_ingresos / 1000).toFixed(0)}k ingresos
                              </div>
                            </div>
                          </div>
                        ))}
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
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Productos Más Vendidos
                      </CardTitle>
                      <CardDescription>
                        Distribución de ventas por producto
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
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
                </div>

                {/* Pedidos Cancelados - Sección Elegante */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      Pedidos Cancelados
                    </CardTitle>
                    <CardDescription>
                      Análisis detallado de pedidos cancelados por sede
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Contador Grande Total */}
                      <div className="lg:col-span-1">
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
                          <div className="text-5xl font-bold text-red-600 mb-2">
                            {canceledStats.length}
                          </div>
                          <div className="text-lg font-semibold text-red-800 mb-1">
                            Total Cancelados
                          </div>
                          <div className="text-sm text-red-600">
                            En el período seleccionado
                          </div>
                        </div>
                      </div>

                      {/* Lista de Sedes */}
                      <div className="lg:col-span-2">
                        <div className="space-y-3">
                          <h3 className="font-semibold text-lg text-gray-800 mb-4">
                            Cancelados por Sede
                          </h3>
                          <div className="max-h-80 overflow-y-auto space-y-2">
                            {canceledBySede.length > 0 ? (
                              canceledBySede.map((sede, index) => (
                                <div 
                                  key={sede.sede_id || 'sin-sede'}
                                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg transition-all duration-200 cursor-pointer hover:bg-red-50 hover:border-red-300 hover:shadow-md group"
                                  onClick={() => {
                                    loadCanceledOrdersDetailsBySede(
                                      sede.sede_id,
                                      sede.sede_nombre || 'Sin Sede'
                                    );
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors"></div>
                                    <div>
                                      <div className="font-semibold text-gray-900 group-hover:text-red-800 transition-colors">
                                        {sede.sede_nombre || 'Sin Sede'}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        Sede #{index + 1}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-red-600 group-hover:text-red-700 transition-colors">
                                      {sede.count}
                                    </div>
                                    <div className="text-xs text-gray-500 group-hover:text-red-600 transition-colors">
                                      cancelados
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <XCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-lg font-medium mb-1">No hay pedidos cancelados</p>
                                <p className="text-sm">En el período seleccionado</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Información adicional */}
                    {canceledStats.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-gray-800">
                              {canceledBySede.length}
                            </div>
                            <div className="text-sm text-gray-600">Sedes Afectadas</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-gray-800">
                              {canceledBySede.length > 0 ? Math.round(canceledStats.length / canceledBySede.length) : 0}
                            </div>
                            <div className="text-sm text-gray-600">Promedio por Sede</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-gray-800">
                              {canceledBySede.length > 0 ? Math.max(...canceledBySede.map(s => s.count)) : 0}
                            </div>
                            <div className="text-sm text-gray-600">Máximo por Sede</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-2xl font-bold text-gray-800">
                              {((canceledStats.length / (metricsData?.totalGeneral.pedidos || 1)) * 100).toFixed(1)}%
                            </div>
                            <div className="text-sm text-gray-600">Tasa de Cancelación</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Acceso a Métricas de Tiempo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Análisis de Tiempos por Fases
                </CardTitle>
                <CardDescription>
                  Accede al análisis detallado de tiempos de procesamiento de pedidos por fase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={onNavigateToTimeMetrics}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <BarChart3 className="h-4 w-4" />
                  Abrir Métricas de Tiempo
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dialog para editar sede */}
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
                    <SelectItem value="">Sin sede</SelectItem>
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
                <Label htmlFor="repartidor-sede">Sede (opcional)</Label>
                <Select value={repartidorFormData.sede_id} onValueChange={(value) => setRepartidorFormData({ ...repartidorFormData, sede_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin sede</SelectItem>
                    {sedesSimple.map((sede) => (
                      <SelectItem key={sede.id} value={sede.id}>
                        {sede.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        {/* Modal para ver pedidos cancelados */}
        <Dialog open={showCanceledModal} onOpenChange={setShowCanceledModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Pedidos Cancelados ({canceledOrdersList.length})
              </DialogTitle>
              <DialogDescription>
                Lista detallada de todos los pedidos cancelados con sus motivos
              </DialogDescription>
            </DialogHeader>
            
            {loadingCanceled ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Cargando pedidos cancelados...
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {canceledOrdersList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Sede</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Fecha Cancelación</TableHead>
                          <TableHead className="min-w-[200px]">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {canceledOrdersList.map((order, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {order.id_display}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.cliente_nombre}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {order.sede}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-green-600">
                                ${order.total.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {order.cancelado_at ? 
                                new Date(order.cancelado_at).toLocaleString('es-CO', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                }) : 
                                'No disponible'
                              }
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                <div className="text-sm bg-red-50 border border-red-200 rounded-md p-2">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-red-800 text-xs leading-relaxed whitespace-pre-wrap break-words">
                                      {order.motivo_cancelacion}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <XCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No hay pedidos cancelados</p>
                    <p className="text-sm">Todos los pedidos han sido procesados exitosamente</p>
                  </div>
                )}
                
                <div className="flex justify-end pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCanceledModal(false)}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal para Detalles de Pedidos Cancelados por Sede */}
        <Dialog open={canceledDetailsModalOpen} onOpenChange={setCanceledDetailsModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Pedidos Cancelados - {selectedSedeDetails?.sede_nombre}
              </DialogTitle>
              <DialogDescription>
                Detalles completos de todos los pedidos cancelados para esta sede
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Barra de búsqueda */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ID pedido, cliente, teléfono o motivo..."
                    value={canceledSearchTerm}
                    onChange={(e) => {
                      setCanceledSearchTerm(e.target.value);
                      setCanceledCurrentPage(1); // Reset to first page when searching
                    }}
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {filteredCanceledOrders.length} de {canceledOrdersDetails.length} pedidos
                </div>
              </div>

              {/* Tabla de pedidos cancelados */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto">
                  {canceledDetailsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Cargando detalles...</span>
                    </div>
                  ) : paginatedCanceledOrders.length > 0 ? (
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="w-[100px]">ID Pedido</TableHead>
                          <TableHead className="w-[150px]">Cliente</TableHead>
                          <TableHead className="w-[120px]">Teléfono</TableHead>
                          <TableHead className="w-[200px]">Dirección</TableHead>
                          <TableHead className="w-[100px]">Total</TableHead>
                          <TableHead className="w-[120px]">Fecha Pedido</TableHead>
                          <TableHead className="w-[120px]">Fecha Cancelación</TableHead>
                          <TableHead className="min-w-[300px]">Motivo de Cancelación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedCanceledOrders.map((order, index) => (
                          <TableRow key={order.id} className="hover:bg-red-50/50">
                            <TableCell className="font-mono font-medium text-blue-600">
                              {order.id_display}
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.cliente_nombre}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {order.cliente_telefono}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={order.cliente_direccion}>
                              {order.cliente_direccion}
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ${order.total.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'No disponible'}
                            </TableCell>
                            <TableCell className="text-sm text-red-600 font-medium">
                              {order.cancelado_at ? new Date(order.cancelado_at).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'No disponible'}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="p-2 bg-red-50 rounded-md border border-red-200">
                                <p className="text-sm text-red-800 break-words">
                                  {order.motivo_cancelacion}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <XCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium mb-2">
                        {canceledSearchTerm ? 'No se encontraron pedidos' : 'No hay pedidos cancelados'}
                      </p>
                      <p className="text-sm">
                        {canceledSearchTerm ? 
                          'Intenta con otros términos de búsqueda' : 
                          'Esta sede no tiene pedidos cancelados en el período seleccionado'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Paginación */}
              {totalCanceledPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Página {canceledCurrentPage} de {totalCanceledPages}
                    {' '} • {filteredCanceledOrders.length} pedidos totales
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCanceledCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={canceledCurrentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {/* Show page numbers */}
                      {Array.from({ length: Math.min(5, totalCanceledPages) }, (_, i) => {
                        let pageNumber;
                        if (totalCanceledPages <= 5) {
                          pageNumber = i + 1;
                        } else if (canceledCurrentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (canceledCurrentPage >= totalCanceledPages - 2) {
                          pageNumber = totalCanceledPages - 4 + i;
                        } else {
                          pageNumber = canceledCurrentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNumber}
                            variant={canceledCurrentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCanceledCurrentPage(pageNumber)}
                            className="w-8 h-8"
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCanceledCurrentPage(prev => Math.min(prev + 1, totalCanceledPages))}
                      disabled={canceledCurrentPage === totalCanceledPages}
                      className="flex items-center gap-1"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCanceledDetailsModalOpen(false);
                  setCanceledSearchTerm('');
                  setCanceledCurrentPage(1);
                }}
              >
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}