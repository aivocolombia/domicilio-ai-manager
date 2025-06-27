
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dashboard } from '@/components/Dashboard';
import { Inventory } from '@/components/Inventory';
import { Order, InventoryItem, DeliverySettings, OrderSource } from '@/types/delivery';
import { LayoutDashboard, Package, Settings } from 'lucide-react';

// Mock data generator
const generateMockOrders = (): Order[] => {
  const sources: OrderSource[] = ['ai_agent', 'call_center'];
  const statuses = ['received', 'kitchen', 'delivery', 'delivered'] as const;
  const customers = [
    { name: 'Juan Pérez', phone: '300-123-4567' },
    { name: 'María García', phone: '301-987-6543' },
    { name: 'Carlos López', phone: '302-456-7890' },
    { name: 'Ana Rodríguez', phone: '303-321-0987' },
    { name: 'Luis Martínez', phone: '304-654-3210' }
  ];

  return Array.from({ length: 15 }, (_, i) => {
    const createdAt = new Date();
    createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 4));
    
    const estimatedDeliveryTime = new Date(createdAt);
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 30 + Math.floor(Math.random() * 30));
    
    const customer = customers[Math.floor(Math.random() * customers.length)];
    
    return {
      id: `ORD-${Date.now()}-${i}`,
      customerName: customer.name,
      customerPhone: customer.phone,
      address: `Calle ${Math.floor(Math.random() * 100)} #${Math.floor(Math.random() * 50)}-${Math.floor(Math.random() * 100)}`,
      items: [
        {
          id: `item-${i}`,
          productId: 'pizza-1',
          productName: 'Pizza Margarita',
          quantity: 1,
          price: 25000,
          toppings: [
            { id: 'topping-1', name: 'Queso Extra', price: 3000 }
          ]
        }
      ],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      totalAmount: 25000 + Math.floor(Math.random() * 15000),
      estimatedDeliveryTime,
      createdAt,
      source: sources[Math.floor(Math.random() * sources.length)],
      specialInstructions: Math.random() > 0.7 ? 'Sin cebolla, extra salsa' : undefined,
    };
  });
};

const generateMockInventory = (): InventoryItem[] => {
  return [
    {
      id: 'pizza-1',
      name: 'Pizza Margarita',
      description: 'Pizza clásica con tomate, mozzarella y albahaca',
      price: 25000,
      category: 'Pizzas',
      isAvailable: true,
      estimatedPrepTime: 15,
      availableToppings: [
        { id: 'top-1', name: 'Queso Extra', price: 3000 },
        { id: 'top-2', name: 'Pepperoni', price: 4000 },
        { id: 'top-3', name: 'Champiñones', price: 3500 },
        { id: 'top-4', name: 'Aceitunas', price: 0 }
      ]
    },
    {
      id: 'pizza-2',
      name: 'Pizza Pepperoni',
      description: 'Pizza con pepperoni y mozzarella',
      price: 28000,
      category: 'Pizzas',
      isAvailable: false,
      estimatedPrepTime: 15,
      availableToppings: [
        { id: 'top-1', name: 'Queso Extra', price: 3000 },
        { id: 'top-5', name: 'Jalapeños', price: 2500 }
      ]
    },
    {
      id: 'burger-1',
      name: 'Hamburguesa Clásica',
      description: 'Hamburguesa con carne, lechuga, tomate y queso',
      price: 18000,
      category: 'Hamburguesas',
      isAvailable: true,
      estimatedPrepTime: 10,
      availableToppings: [
        { id: 'top-6', name: 'Tocino', price: 3000 },
        { id: 'top-7', name: 'Aguacate', price: 2500 }
      ]
    },
    {
      id: 'drink-1',
      name: 'Coca Cola',
      description: 'Bebida gaseosa 350ml',
      price: 3500,
      category: 'Bebidas',
      isAvailable: true,
      estimatedPrepTime: 1,
      availableToppings: []
    },
    {
      id: 'drink-2',
      name: 'Jugo Natural',
      description: 'Jugo de frutas naturales 400ml',
      price: 5000,
      category: 'Bebidas',
      isAvailable: false,
      estimatedPrepTime: 3,
      availableToppings: []
    }
  ];
};

const Index = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
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
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard
              orders={orders}
              settings={settings}
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

          <TabsContent value="settings">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">Configuración</h2>
              <p className="text-muted-foreground">
                Panel de configuración avanzada - próximamente
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
