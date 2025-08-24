import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dashboard } from '@/components/Dashboard';
import { Inventory } from '@/components/Inventory';
import { DeliveryPersonnel } from '@/components/DeliveryPersonnel';
import CallCenter from '@/components/CallCenter';
import { UserProfile } from '@/components/UserProfile';
import { SedeOrders } from '@/components/SedeOrders';
import { AdminPanel } from '@/components/AdminPanel';
import { TimeMetricsPage } from '@/components/TimeMetricsPage';
import { Order, DeliverySettings, OrderSource, DeliveryPerson, PaymentMethod, PaymentStatus, User as UserType, Sede } from '@/types/delivery';
import { LayoutDashboard, Package, Users, Phone, Store, Settings, Building2, ChevronDown } from 'lucide-react';
import { StatusBar } from '@/components/StatusBar';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { SedeProvider } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
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
  const { profile } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTimeMetrics, setShowTimeMetrics] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([]);
  const [currentUser] = useState<UserType>(generateMockUser());
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedesLoading, setSedesLoading] = useState(false);
  
  // Estado para sede seleccionada por admin (solo para admins)
  const [selectedSedeId, setSelectedSedeId] = useState<string>(() => {
    // Admin empieza con la primera sede disponible, agentes usan su sede asignada
    return profile?.role === 'admin' ? profile?.sede_id || sedes[0]?.id : profile?.sede_id || '';
  });
  const [settings, setSettings] = useState<DeliverySettings>({
    acceptingOrders: true,
    defaultDeliveryTime: 30,
    maxOrdersPerHour: 20,
    deliveryFee: 3000
  });

  // Sede efectiva: la seleccionada por admin o la asignada al agente
  const effectiveSedeId = profile?.role === 'admin' ? selectedSedeId : profile?.sede_id;
  
  // Nombre de la sede (buscar en array de sedes cargadas o usar nombre del perfil)
  const currentSedeName = sedes.find(s => s.id === effectiveSedeId)?.name || 
                          profile?.sede_name || 
                          'Sede Desconocida';

  // Cargar sedes reales desde la base de datos
  const loadSedes = async () => {
    if (profile?.role !== 'admin') return; // Solo admins necesitan cargar todas las sedes
    
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

  useEffect(() => {
    // Initialize with mock data (temporary until API is ready)
    setOrders(generateMockOrders());
    setDeliveryPersonnel(generateMockDeliveryPersonnel());
  }, []);

  // Cargar sedes cuando el perfil esté disponible (solo para admins)
  useEffect(() => {
    if (profile?.role === 'admin') {
      loadSedes();
    }
  }, [profile?.role]);

  const handleCreateOrder = (orderData: Omit<Order, 'id' | 'createdAt' | 'estimatedDeliveryTime'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `ORD-${Date.now()}`,
      createdAt: new Date(),
      estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
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
      <AdminPanel 
        onBack={() => setShowAdminPanel(false)}
        onNavigateToTimeMetrics={() => {
          setShowAdminPanel(false);
          setShowTimeMetrics(true);
        }}
      />
    );
  }

  // Si showTimeMetrics es true, mostrar las métricas de tiempo
  if (showTimeMetrics) {
    return <TimeMetricsPage onBack={() => setShowTimeMetrics(false)} />;
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
                {/* Selector de Sede - Solo visible para administradores */}
                {profile?.role === 'admin' && (
                  <div className="flex items-center gap-2 text-white">
                    <Building2 className="h-4 w-4" />
                    <Select value={selectedSedeId} onValueChange={setSelectedSedeId}>
                      <SelectTrigger className="w-48 bg-brand-secondary text-white border-brand-secondary hover:bg-brand-primary">
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

                {/* Admin Panel Button - Solo visible para administradores */}
                {profile?.role === 'admin' && (
                  <Button
                    variant="outline"
                    onClick={() => setShowAdminPanel(true)}
                    className="flex items-center gap-2 bg-brand-secondary text-white border-brand-secondary hover:bg-brand-primary"
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
        <StatusBar orders={orders} currentSede={currentUser.sede} />

        <div className="container mx-auto p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5 bg-brand-secondary">
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
            <TabsTrigger value="callcenter" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Phone className="h-4 w-4" />
              Call Center
            </TabsTrigger>
            <TabsTrigger value="sede" className="flex items-center gap-2 data-[state=active]:bg-brand-primary data-[state=active]:text-white">
              <Store className="h-4 w-4" />
              Sede Local
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard
              orders={orders}
              settings={settings}
              deliveryPersonnel={deliveryPersonnel}
              onUpdateOrders={setOrders}
              onUpdateSettings={setSettings}
            />
          </TabsContent>

          <TabsContent value="inventory">
            <Inventory />
          </TabsContent>

          <TabsContent value="personnel">
            <DeliveryPersonnel />
          </TabsContent>

          <TabsContent value="callcenter">
            <CallCenter
              orders={orders}
              sedes={sedes}
              settings={settings}
              onCreateOrder={handleCreateOrder}
            />
          </TabsContent>

          <TabsContent value="sede">
            <SedeOrders
              orders={orders}
              sedes={sedes}
              currentUser={currentUser}
              settings={settings}
              onCreateOrder={handleCreateOrder}
              onTransferOrder={handleTransferOrder}
            />
          </TabsContent>
        </Tabs>
        </div>
      </div>
      </InventoryProvider>
    </SedeProvider>
  );
};

export default Index;
