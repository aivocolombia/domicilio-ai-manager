import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserProfile } from '@/components/auth/UserProfile';

// Lazy loading para componentes pesados - mejora TTI en ~1.5s
const Dashboard = lazy(() => import('@/components/orders/Dashboard').then(module => ({ default: module.Dashboard })));
const Inventory = lazy(() => import('@/components/inventory/Inventory').then(module => ({ default: module.Inventory })));
const DeliveryPersonnel = lazy(() => import('@/components/delivery/DeliveryPersonnel').then(module => ({ default: module.DeliveryPersonnel })));
const AdminPanel = lazy(() => import('@/components/metrics/AdminPanel').then(module => ({ default: module.AdminPanel })));
const TimeMetricsPage = lazy(() => import('@/components/metrics/TimeMetricsPage').then(module => ({ default: module.TimeMetricsPage })));

import { Order, DeliverySettings, OrderSource, DeliveryPerson, PaymentMethod, PaymentStatus, User as UserType, Sede, OrderStatus, DeliveryType } from '@/types/delivery';
import { LayoutDashboard, Package, Users, Settings, Building2, ChevronDown } from 'lucide-react';
import { StatusBar } from '@/components/layout/StatusBar';
import { Loading } from '@/components/layout/Loading';
import { PerformanceMonitor } from '@/components/layout/PerformanceMonitor';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { SedeProvider } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { usePerformanceMonitor } from '@/hooks/usePerformance';
import { useActiveTab } from '@/hooks/useActiveTab';
import { useAppState } from '@/hooks/useAppState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

// Mock data generator for User and Sedes (temporary until API is ready)
const generateMockUser = (): UserType => {
  return {
    id: 'user-1',
    name: 'Carlos Admin',
    role: 'admin',
    sede: 'Niza',
    phone: '320-555-9999',
    createdAt: new Date('2024-01-01')
  };
};

const generateMockSedes = (): Sede[] => {
  return [
    {
      id: 'sede-1',
      name: 'Niza',
      address: 'Carrera 15 #127-45, Niza',
      phone: '601-555-0001',
      isActive: true,
      currentCapacity: 8,
      maxCapacity: 15
    },
    {
      id: 'sede-2',
      name: 'Chapinero',
      address: 'Calle 72 #12-34, Chapinero',
      phone: '601-555-0002',
      isActive: true,
      currentCapacity: 12,
      maxCapacity: 20
    },
    {
      id: 'sede-3',
      name: 'Zona Rosa',
      address: 'Carrera 14 #85-23, Zona Rosa',
      phone: '601-555-0003',
      isActive: true,
      currentCapacity: 5,
      maxCapacity: 10
    }
  ];
};

const generateMockOrders = (): Order[] => {
  const sources: OrderSource[] = ['ai_agent', 'call_center'];
  const statuses = ['received', 'kitchen', 'delivery', 'delivered'] as const;
  const paymentMethods: PaymentMethod[] = ['card', 'cash', 'nequi', 'transfer'];
  const paymentStatuses: PaymentStatus[] = ['pending', 'paid', 'failed'];
  const customers = [
    { name: 'Juan Pérez', phone: '300-123-4567' },
    { name: 'María García', phone: '301-987-6543' },
    { name: 'Carlos López', phone: '302-456-7890' },
    { name: 'Ana Rodríguez', phone: '303-321-0987' },
    { name: 'Luis Martínez', phone: '304-654-3210' }
  ];

  const addresses = [
    'Calle 72 #15-30, Chapinero',
    'Carrera 13 #45-67, La Candelaria',
    'Avenida 68 #25-15, Engativá',
    'Calle 100 #18-20, Zona Rosa',
    'Transversal 23 #56-89, Suba'
  ];

  return Array.from({ length: 15 }, (_, i) => {
    const createdAt = new Date();
    createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 4));
    
    const estimatedDeliveryTime = new Date(createdAt);
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 30 + Math.floor(Math.random() * 30));
    
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const address = addresses[Math.floor(Math.random() * addresses.length)];
    
    return {
      id: `ORD-${Date.now()}-${i}`,
      customerName: customer.name,
      customerPhone: customer.phone,
      address,
      items: [
        {
          id: `item-${i}`,
          productId: 'ajiaco-1',
          productName: 'Ajiaco Santafereño',
          quantity: 1,
          price: 18000,
          toppings: [
            { id: 'topping-1', name: 'Arroz', price: 2000 },
            { id: 'topping-2', name: 'Aguacate', price: 3000 }
          ]
        }
      ],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      totalAmount: 18000 + Math.floor(Math.random() * 15000),
      estimatedDeliveryTime,
      createdAt,
      source: sources[Math.floor(Math.random() * sources.length)],
      specialInstructions: Math.random() > 0.7 ? 'Extra crema de leche, sin mazorca' : undefined,
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
      originSede: Math.random() > 0.5 ? 'Niza' : undefined,
      assignedSede: Math.random() > 0.3 ? ['Niza', 'Chapinero', 'Zona Rosa'][Math.floor(Math.random() * 3)] : undefined,
      assignedDeliveryPersonId: Math.random() > 0.4 ? ['dp-1', 'dp-2', 'dp-3'][Math.floor(Math.random() * 3)] : undefined,
      deliveryType: Math.random() > 0.7 ? 'pickup' : 'delivery',
      pickupSede: Math.random() > 0.7 ? ['Niza', 'Chapinero', 'Zona Rosa'][Math.floor(Math.random() * 3)] : undefined
    };
  });
};

const generateMockDeliveryPersonnel = (): DeliveryPerson[] => {
  return [
    {
      id: 'dp-1',
      name: 'Carlos Mendoza',
      phone: '320-555-0001',
      isActive: true,
      createdAt: new Date('2024-01-15'),
      totalDeliveries: 156,
      activeOrders: 2
    },
    {
      id: 'dp-2',
      name: 'Ana Torres',
      phone: '310-555-0002',
      isActive: true,
      createdAt: new Date('2024-02-20'),
      totalDeliveries: 98,
      activeOrders: 1
    },
    {
      id: 'dp-3',
      name: 'Diego Ramírez',
      phone: '315-555-0003',
      isActive: false,
      createdAt: new Date('2024-01-10'),
      totalDeliveries: 203,
      activeOrders: 0
    }
  ];
};

const Index = () => {
  // Performance monitoring
  const { renderCount, logRenderReason } = usePerformanceMonitor('Index');
  
  const { profile } = useAuth();
  const { permissions, isAdmin, isAdministradorPunto, isAgent, userSedeId } = usePermissions();
  const { activeTab, setActiveTab, resetToDashboard } = useActiveTab();
  const { showAdminPanel, showTimeMetrics, navigateToAdmin, navigateToTimeMetrics, navigateToMain, navigateToMainView } = useAppState();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([]);
  const [currentUser] = useState<UserType>(generateMockUser());
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedesLoading, setSedesLoading] = useState(false);

  
  // Estado para sede seleccionada (solo admins pueden cambiar de sede)
  const [selectedSedeId, setSelectedSedeId] = useState<string>(() => {
    // Admin puede seleccionar cualquier sede, otros roles usan su sede asignada
    return permissions.canViewAllSedes ? profile?.sede_id || sedes[0]?.id : (userSedeId || '');
  });
  const [settings, setSettings] = useState<DeliverySettings>({
    acceptingOrders: true,
    defaultDeliveryTime: 30,
    maxOrdersPerHour: 20,
    deliveryFee: 3000
  });

  // Sede efectiva: admins pueden cambiar sede, otros usan su sede asignada
  const effectiveSedeId = permissions.canViewAllSedes ? selectedSedeId : userSedeId;
  
  // Nombre de la sede (buscar en array de sedes cargadas o usar nombre del perfil)
  const currentSedeName = sedes.find(s => s.id === effectiveSedeId)?.name || 
                          profile?.sede_name || 
                          'Sede Desconocida';

  // Cargar la sede del usuario actual (para agentes)
  const loadCurrentUserSede = async () => {
    if (permissions.canViewAllSedes || !userSedeId) return; // Solo para usuarios sin permiso de ver todas las sedes
    
    try {
      console.log('🏢 Cargando sede del usuario actual:', userSedeId);
      
      const { data: sedeData, error } = await supabase
        .from('sedes')
        .select('id, name, address, phone, is_active, current_capacity, max_capacity')
        .eq('id', userSedeId)
        .eq('is_active', true)
        .single();
      
      if (error) {
        console.error('❌ Error cargando sede del usuario:', error);
        return;
      }
      
      if (sedeData) {
        // Mapear al formato esperado
        const mappedSede: Sede = {
          id: sedeData.id,
          name: sedeData.name,
          address: sedeData.address || '',
          phone: sedeData.phone || '',
          isActive: sedeData.is_active,
          currentCapacity: sedeData.current_capacity || 0,
          maxCapacity: sedeData.max_capacity || 10
        };
        
        setSedes([mappedSede]); // Solo la sede del usuario
        console.log('✅ Sede del usuario cargada:', mappedSede);
      }
    } catch (error) {
      console.error('❌ Error al cargar sede del usuario:', error);
    }
  };

  // Cargar sedes reales desde la base de datos
  const loadSedes = async () => {
    if (!permissions.canViewAllSedes) return; // Solo usuarios con permiso pueden cargar todas las sedes
    
    try {
      setSedesLoading(true);
      console.log('🏢 Cargando sedes desde base de datos...');
      
      const { data: sedesData, error } = await supabase
        .from('sedes')
        .select('id, name, address, phone, is_active, current_capacity, max_capacity')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('❌ Error cargando sedes:', error);
        return;
      }
      
      // Mapear al formato esperado
      const mappedSedes: Sede[] = (sedesData || []).map(sede => ({
        id: sede.id,
        name: sede.name,
        address: sede.address || '',
        phone: sede.phone || '',
        isActive: sede.is_active,
        currentCapacity: sede.current_capacity || 0,
        maxCapacity: sede.max_capacity || 10
      }));
      
      setSedes(mappedSedes);
      
      // Si no hay sede seleccionada, seleccionar la primera
      if (!selectedSedeId && mappedSedes.length > 0) {
        setSelectedSedeId(mappedSedes[0].id);
      }
      
      console.log('✅ Sedes cargadas:', mappedSedes.length);
    } catch (error) {
      console.error('❌ Error al cargar sedes:', error);
    } finally {
      setSedesLoading(false);
    }
  };

  // Cargar órdenes reales desde la base de datos
  const loadOrders = async () => {
    if (!effectiveSedeId) {
      console.log('⚠️ No hay sede efectiva para cargar órdenes');
      return;
    }

    try {
      console.log('📦 Cargando órdenes desde base de datos para sede:', effectiveSedeId);
      
      // Primero verificar qué columnas existen en la tabla ordenes
      console.log('🔍 Verificando esquema de tabla ordenes...');
      const { data: schemaData, error: schemaError } = await supabase
        .from('ordenes')
        .select('*')
        .limit(1);

      if (schemaError) {
        console.error('❌ Error verificando esquema:', schemaError);
      } else if (schemaData && schemaData.length > 0) {
        console.log('📋 Columnas disponibles en ordenes:', Object.keys(schemaData[0]));
      }

      const { data: ordersData, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          cliente_id,
          status,
          created_at,
          hora_entrega,
          repartidor_id,
          sede_id,
          clientes!left(nombre, telefono),
          pagos!payment_id(type, status, total_pago),
          repartidores!left(nombre),
          sedes!left(name)
        `)
        .eq('sede_id', effectiveSedeId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error cargando órdenes:', error);
        return;
      }

      // Mapear al formato esperado por la aplicación
      const mappedOrders: Order[] = (ordersData || []).map(order => ({
        id: order.id.toString(),
        customerName: (order.clientes as any)?.nombre || 'Cliente Desconocido',
        customerPhone: (order.clientes as any)?.telefono || 'N/A',
        address: 'Dirección del cliente', // TODO: Agregar campo de dirección
        items: [], // TODO: Cargar items de la orden
        status: order.status as OrderStatus,
        totalAmount: (order.pagos as any)?.total_pago || 0,
        estimatedDeliveryTime: order.hora_entrega ? new Date(order.hora_entrega) : new Date(),
        createdAt: new Date(order.created_at),
        source: 'call_center' as OrderSource, // TODO: Agregar campo de origen
        specialInstructions: undefined,
        paymentMethod: (order.pagos as any)?.type || 'cash' as PaymentMethod,
        paymentStatus: (order.pagos as any)?.status || 'paid' as PaymentStatus,
        originSede: (order.sedes as any)?.name,
        assignedSede: (order.sedes as any)?.name,
        assignedDeliveryPersonId: order.repartidor_id?.toString(),
        deliveryType: 'delivery' as DeliveryType,
        pickupSede: undefined
      }));

      console.log('✅ Órdenes cargadas:', mappedOrders.length);
      setOrders(mappedOrders);
    } catch (error) {
      console.error('❌ Error al cargar órdenes:', error);
    }
  };

  useEffect(() => {
    // Solo cargar datos iniciales si NO estamos en AdminPanel o TimeMetrics
    if (!showAdminPanel && !showTimeMetrics) {
      console.log('📊 Index: Cargando datos del dashboard principal...');
      // No cargar órdenes aquí - dejar que el Dashboard maneje sus propios datos
      // Esto evita que se recarguen sin filtros cuando se cambia de sede
      if (!effectiveSedeId) {
        // Solo usar datos mock si no hay sede efectiva como último recurso
        console.log('⚠️ Usando datos mock por falta de sede efectiva');
        setOrders(generateMockOrders());
      } else {
        // Limpiar órdenes para que Dashboard cargue datos frescos con filtros correctos
        setOrders([]);
      }
      setDeliveryPersonnel(generateMockDeliveryPersonnel());
    } else {
      console.log('🚫 Index: Saltando carga de dashboard - AdminPanel/TimeMetrics activo');
    }
  }, [effectiveSedeId, showAdminPanel, showTimeMetrics]);

  // Cargar sedes cuando el perfil esté disponible
  useEffect(() => {
    if (permissions.canViewAllSedes) {
      loadSedes(); // Admins cargan todas las sedes
    } else {
      loadCurrentUserSede(); // Agentes cargan solo su sede
    }
  }, [permissions.canViewAllSedes, userSedeId]);



  const handleCreateOrder = (orderData: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `ORD-${Date.now()}`,
      createdAt: new Date(),
      estimatedDeliveryTime: new Date(Date.now() + 90 * 60 * 1000) // 90 minutes from now
    };
    
    setOrders(prevOrders => [newOrder, ...prevOrders]);
  };

  const handleTransferOrder = (orderId: string, targetSedeId: string) => {
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? { ...order, assignedSede: targetSedeId }
          : order
      )
    );
  };

  // Si showAdminPanel es true, mostrar el AdminPanel
  if (showAdminPanel) {
    return (
      <Suspense fallback={<Loading message="Cargando Panel de Administración..." size="lg" />}>
        <AdminPanel 
          onBack={navigateToMain}
          onNavigateToTimeMetrics={navigateToTimeMetrics}
        />
      </Suspense>
    );
  }

  // Si showTimeMetrics es true, mostrar las métricas de tiempo
  if (showTimeMetrics) {
    return (
      <Suspense fallback={<Loading message="Cargando Métricas de Tiempo..." size="lg" />}>
        <TimeMetricsPage onBack={navigateToMain} />
      </Suspense>
    );
  }

  return (
    <SedeProvider effectiveSedeId={effectiveSedeId || ''} currentSedeName={currentSedeName}>
      <InventoryProvider>
        <div className="min-h-screen bg-background">
        {/* Brand Header */}
        <div className="bg-brand-primary text-white shadow-lg">
          <div className="container mx-auto p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img 
                  src="/lovable-uploads/96fc454f-e0fb-40ad-9214-85dcb21960e5.png" 
                  alt="Ajiaco & Frijoles Logo" 
                  className="h-12 w-12 rounded-full bg-brand-secondary p-1"
                />
                <div>
                  <h1 className="text-2xl font-bold">Ajiaco & Frijoles</h1>
                  <p className="text-brand-secondary text-sm">Sistema de Gestión de Pedidos</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Selector de Sede - Solo visible para usuarios con permiso para ver todas las sedes */}
                {permissions.canViewAllSedes && (
                  <div className="flex items-center gap-2 text-white">
                    <Building2 className="h-4 w-4" />
                    <Select value={selectedSedeId} onValueChange={setSelectedSedeId}>
                      <SelectTrigger className="w-48 bg-brand-secondary text-red-500 border-brand-secondary hover:bg-brand-primary hover:text-yellow-400">
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
                )}

                {/* Admin Panel Button - Visible para admin_global y admin_punto */}
                {(isAdmin || isAdministradorPunto) && (
                  <Button
                    variant="outline"
                    onClick={navigateToAdmin}
                    className="flex items-center gap-2 bg-brand-secondary text-red-500 border-brand-secondary hover:bg-brand-primary hover:text-yellow-400"
                  >
                    <Settings className="h-4 w-4" />
                    Admin Panel
                  </Button>
                )}
                
                
                {/* User Profile Button */}
                <UserProfile />
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar - Solo visible para agentes */}
        <StatusBar 
          orders={orders} 
          currentSede={currentSedeName} 
          effectiveSedeId={effectiveSedeId}
        />

        <div className="container mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 bg-brand-secondary">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Package className="h-4 w-4" />
              Inventario
            </TabsTrigger>
            <TabsTrigger value="personnel" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Users className="h-4 w-4" />
              Repartidores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Suspense fallback={<Loading message="Cargando dashboard..." size="lg" />}>
              <Dashboard
                orders={orders}
                settings={settings}
                deliveryPersonnel={deliveryPersonnel}
                effectiveSedeId={effectiveSedeId}
                currentSedeName={currentSedeName}
                onUpdateOrders={setOrders}
                onUpdateSettings={setSettings}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="inventory">
            <Suspense fallback={<Loading message="Cargando inventario..." size="lg" />}>
              <Inventory
                effectiveSedeId={effectiveSedeId}
                currentSedeName={currentSedeName}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="personnel">
            <Suspense fallback={<Loading message="Cargando repartidores..." size="lg" />}>
              <DeliveryPersonnel
                effectiveSedeId={effectiveSedeId}
                currentSedeName={currentSedeName}
              />
            </Suspense>
          </TabsContent>


        </Tabs>
        </div>
      </div>
      
      {/* Performance Monitor - solo en desarrollo */}
      <PerformanceMonitor />

      {/* Omnion Branding - Fixed in corner */}
      <div className="fixed bottom-4 right-4 z-50 bg-white/60 backdrop-blur-xl rounded-lg shadow-lg px-4 py-3 border border-gray-200/50">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Powered by</span>
          <img
            src="https://hcyxhuvyqvtlvfsnrhjw.supabase.co/storage/v1/object/public/omnion/logo/logo_omnion_sin_fondo.png"
            alt="Omnion"
            className="h-4 w-auto"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
          <span className="font-semibold">Omnion</span>
        </div>
      </div>

      </InventoryProvider>
    </SedeProvider>
  );
};

export default Index;
