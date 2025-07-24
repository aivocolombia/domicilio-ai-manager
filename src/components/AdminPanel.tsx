import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Users, Building2, UserCheck, UserX, TrendingUp, DollarSign, Package, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { supabase, type Database } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'


type Profile = Database['public']['Tables']['profiles']['Row']
type Sede = Database['public']['Tables']['sedes']['Row']

// Datos de demo para las gráficas
const generateDemoData = () => {
  // Datos de domicilios por día (últimos 7 días)
  const domiciliosPorDia = [
    { dia: 'Lun', domicilios: 45, ganancia: 675000 },
    { dia: 'Mar', domicilios: 52, ganancia: 780000 },
    { dia: 'Mié', domicilios: 38, ganancia: 570000 },
    { dia: 'Jue', domicilios: 61, ganancia: 915000 },
    { dia: 'Vie', domicilios: 78, ganancia: 1170000 },
    { dia: 'Sáb', domicilios: 89, ganancia: 1335000 },
    { dia: 'Dom', domicilios: 67, ganancia: 1005000 }
  ]

  // Datos de productos más vendidos
  const productosMasVendidos = [
    { producto: 'Ajiaco', ventas: 210, porcentaje: 60 },
    { producto: 'Frijoles', ventas: 140, porcentaje: 40 }
  ]

  // Datos de ganancias por sede
  const gananciasPorSede = [
    { sede: 'Niza', ganancia: 2850000, domicilios: 234 },
    { sede: 'Centro', ganancia: 3200000, domicilios: 267 },
    { sede: 'Norte', ganancia: 1980000, domicilios: 156 },
    { sede: 'Sur', ganancia: 2450000, domicilios: 189 }
  ]

  // Datos de horarios pico
  const horariosPico = [
    { hora: '12:00', domicilios: 23 },
    { hora: '13:00', domicilios: 45 },
    { hora: '14:00', domicilios: 38 },
    { hora: '15:00', domicilios: 28 },
    { hora: '16:00', domicilios: 32 },
    { hora: '17:00', domicilios: 41 },
    { hora: '18:00', domicilios: 67 },
    { hora: '19:00', domicilios: 89 },
    { hora: '20:00', domicilios: 76 },
    { hora: '21:00', domicilios: 54 },
    { hora: '22:00', domicilios: 34 }
  ]

  return {
    domiciliosPorDia,
    productosMasVendidos,
    gananciasPorSede,
    horariosPico
  }
}

export function AdminPanel() {
  const [users, setUsers] = useState<Profile[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  
  // Datos de demo para las gráficas
  const demoData = generateDemoData()
  
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

  useEffect(() => {
    console.log('🚀 AdminPanel iniciando...')
    fetchUsers()
    fetchSedes()
  }, [])

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
      console.log('🔍 Intentando obtener sedes...')
      
      const { data, error } = await supabase
        .from('sedes')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('❌ Error obteniendo sedes:', error)
        throw error
      }
      
      console.log('✅ Sedes obtenidas:', data?.length || 0)
      setSedes(data || [])
    } catch (error) {
      console.error('❌ Error fetching sedes:', error)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true
      })

      if (authError) throw authError

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          role: formData.role,
          sede_id: formData.sede_id || null,
          is_active: formData.is_active
        })

      if (profileError) throw profileError

      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente",
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
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive",
      })
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

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

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
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
          <Button variant="outline" onClick={signOut}>
            Cerrar Sesión
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>

        {/* Métricas de Negocio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Domicilios por Día */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Domicilios por Día (Última Semana)
              </CardTitle>
              <CardDescription>
                Tendencia de domicilios y ganancias diarias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoData.domiciliosPorDia.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                      <span className="font-medium">{item.dia}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{item.domicilios} domicilios</div>
                      <div className="text-sm text-muted-foreground">
                        ${(item.ganancia / 1000).toFixed(0)}k ganancia
                      </div>
                    </div>
                  </div>
                ))}
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
                {demoData.productosMasVendidos.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                      ></div>
                      <span className="font-medium">{item.producto}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{item.ventas} ventas</div>
                      <div className="text-sm text-muted-foreground">{item.porcentaje}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ganancias por Sede */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Ganancias por Sede
              </CardTitle>
              <CardDescription>
                Comparación de rendimiento por ubicación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoData.gananciasPorSede.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: `hsl(${index * 90}, 70%, 50%)` }}
                      ></div>
                      <span className="font-medium">{item.sede}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">${(item.ganancia / 1000000).toFixed(1)}M</div>
                      <div className="text-sm text-muted-foreground">{item.domicilios} domicilios</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Horarios Pico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horarios de Mayor Demanda
              </CardTitle>
              <CardDescription>
                Distribución de domicilios por hora del día
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {demoData.horariosPico.map((item, index) => (
                  <div key={index} className="text-center p-2 bg-muted/30 rounded">
                    <div className="text-xs text-muted-foreground">{item.hora}</div>
                    <div className="font-bold text-lg">{item.domicilios}</div>
                    <div className="text-xs">domicilios</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

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
                          {sedes.map((sede) => (
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
                      <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Crear Usuario</Button>
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
                              {sedes.find(s => s.id === user.sede_id)?.name || 'N/A'}
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                          >
                            {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}