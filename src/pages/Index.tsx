import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dashboard } from '@/components/Dashboard';
import { Inventory } from '@/components/Inventory';
import { DeliveryPersonnel } from '@/components/DeliveryPersonnel';
import { Order, InventoryItem, DeliverySettings, OrderSource, DeliveryPerson, PaymentMethod, PaymentStatus } from '@/types/delivery';
import { LayoutDashboard, Package, Users } from 'lucide-react';

// Mock data generator
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
    };
  });
};

const generateMockInventory = (): InventoryItem[] => {
  return [
    {
      id: 'ajiaco-1',
      name: 'Ajiaco Santafereño',
      description: 'Sopa típica colombiana con pollo, papas criollas, guascas y mazorca',
      price: 18000,
      category: 'Platos Principales',
      isAvailable: true,
      estimatedPrepTime: 20,
      availableToppings: [
        { id: 'top-1', name: 'Arroz', price: 2000 },
        { id: 'top-2', name: 'Carne', price: 5000 },
        { id: 'top-3', name: 'Chicharrón', price: 4000 },
        { id: 'top-4', name: 'Plátanos', price: 3000 },
        { id: 'top-5', name: 'Mazorca', price: 3500 },
        { id: 'top-6', name: 'Aguacate', price: 3000 },
        { id: 'top-7', name: 'Crema de Leche', price: 2500 }
      ]
    },
    {
      id: 'frijoles-1',
      name: 'Frijoles',
      description: 'Frijoles rojos tradicionales colombianos con hogao',
      price: 15000,
      category: 'Platos Principales',
      isAvailable: true,
      estimatedPrepTime: 15,
      availableToppings: [
        { id: 'top-1', name: 'Arroz', price: 2000 },
        { id: 'top-2', name: 'Carne', price: 5000 },
        { id: 'top-3', name: 'Chicharrón', price: 4000 },
        { id: 'top-4', name: 'Plátanos', price: 3000 },
        { id: 'top-5', name: 'Mazorca', price: 3500 },
        { id: 'top-6', name: 'Aguacate', price: 3000 },
        { id: 'top-7', name: 'Crema de Leche', price: 2500 }
      ]
    },
    {
      id: 'coca-cola-1',
      name: 'Coca Cola',
      description: 'Gaseosa Coca Cola 350ml',
      price: 3500,
      category: 'Bebidas',
      isAvailable: true,
      estimatedPrepTime: 1,
      availableToppings: []
    },
    {
      id: 'ginger-1',
      name: 'Ginger Ale',
      description: 'Gaseosa Ginger Ale 350ml',
      price: 4000,
      category: 'Bebidas',
      isAvailable: true,
      estimatedPrepTime: 1,
      availableToppings: []
    },
    {
      id: 'limonada-panela-1',
      name: 'Limonada de Panela',
      description: 'Limonada natural endulzada con panela 400ml',
      price: 5500,
      category: 'Bebidas',
      isAvailable: true,
      estimatedPrepTime: 5,
      availableToppings: []
    },
    {
      id: 'limonada-natural-1',
      name: 'Limonada Natural',
      description: 'Limonada natural sin endulzar 400ml',
      price: 5000,
      category: 'Bebidas',
      isAvailable: true,
      estimatedPrepTime: 5,
      availableToppings: []
    }
  ];
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([]);
  const [settings, setSettings] = useState<DeliverySettings>({
    acceptingOrders: true,
    defaultDeliveryTime: 30,
    maxOrdersPerHour: 20,
    deliveryFee: 3000
  });

  useEffect(() => {
    // Initialize with mock data
    setOrders(generateMockOrders());
    setInventory(generateMockInventory());
    setDeliveryPersonnel(generateMockDeliveryPersonnel());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventario
            </TabsTrigger>
            <TabsTrigger value="personnel" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Repartidores
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
            <Inventory
              inventory={inventory}
              onUpdateInventory={setInventory}
            />
          </TabsContent>

          <TabsContent value="personnel">
            <DeliveryPersonnel
              deliveryPersonnel={deliveryPersonnel}
              onUpdateDeliveryPersonnel={setDeliveryPersonnel}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
