import React, { useState, useEffect } from 'react';
import { useInventoryEvents } from '@/contexts/InventoryContext';
import { useAuth } from '@/hooks/useAuth';
import { menuService } from '@/services/menuService';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  AlertTriangle, 
  Package, 
  Coffee, 
  ShoppingCart, 
  Store,
  ChevronDown,
  X,
  RefreshCw
} from 'lucide-react';
import { PlatoConSede, BebidaConSede, ToppingConSede } from '@/types/menu';

interface StatusBarProps {
  orders: any[];
  currentSede?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ orders, currentSede = 'Niza' }) => {
  const { profile } = useAuth();
  const { lastUpdate } = useInventoryEvents();
  const [isOpen, setIsOpen] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [platos, setPlatos] = useState<PlatoConSede[]>([]);
  const [bebidas, setBebidas] = useState<BebidaConSede[]>([]);
  const [toppings, setToppings] = useState<ToppingConSede[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para cargar el inventario con información de sede
  const loadInventoryConSede = async (retryCount = 0) => {
    if (!profile?.sede_id) {
      console.log('⚠️ StatusBar: No hay sede asignada al usuario');
      return;
    }

    try {
      if (retryCount === 0) {
        setLoading(true);
        setError(null);
      }
      console.log('🔍 StatusBar: Cargando inventario para sede:', profile.sede_id, retryCount > 0 ? `(retry ${retryCount})` : '');
      const menuData = await menuService.getMenuConSede(profile.sede_id);
      
      setPlatos(menuData.platos);
      setBebidas(menuData.bebidas);
      setToppings(menuData.toppings || []);
      setError(null); // Clear any previous errors
      
      console.log('✅ StatusBar: Inventario cargado exitosamente');
    } catch (err) {
      console.error('❌ StatusBar: Error al cargar inventario:', err);
      
      // Retry once on connection errors but only if this isn't already a retry
      if (retryCount === 0 && err instanceof Error && (
        err.message.includes('ERR_CONNECTION_CLOSED') || 
        err.message.includes('network') ||
        err.message.includes('fetch') ||
        err.message.includes('Failed to fetch')
      )) {
        console.log('🔄 StatusBar: Reintentando después de error de conexión...');
        setTimeout(() => loadInventoryConSede(1), 3000); // Retry after 3 seconds
        return; // Don't set loading to false yet
      }
      
      // Set error if retry fails or it's not a network error
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      if (retryCount === 0 || retryCount > 0) {
        setLoading(false);
      }
    }
  };

  // Recargar datos cuando se abre el popover
  useEffect(() => {
    if (isOpen) {
      loadInventoryConSede();
    }
  }, [isOpen, profile?.sede_id]);

  // Suscripción en tiempo real a cambios de inventario (reemplaza polling)
  useEffect(() => {
    if (!profile?.sede_id) return;

    // Suscripción a cambios en platos_sedes
    const platosChannel = supabase
      .channel('platos_sedes_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'platos_sedes',
          filter: `sede_id=eq.${profile.sede_id}`
        },
        (payload) => {
          console.log('🔄 Inventario platos actualizado:', payload);
          loadInventoryConSede();
        }
      )
      .subscribe();

    // Suscripción a cambios en bebidas_sedes
    const bebidasChannel = supabase
      .channel('bebidas_sedes_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'bebidas_sedes',
          filter: `sede_id=eq.${profile.sede_id}`
        },
        (payload) => {
          console.log('🔄 Inventario bebidas actualizado:', payload);
          loadInventoryConSede();
        }
      )
      .subscribe();

    // Suscripción a cambios en toppings_sedes
    const toppingsChannel = supabase
      .channel('toppings_sedes_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'toppings_sedes',
          filter: `sede_id=eq.${profile.sede_id}`
        },
        (payload) => {
          console.log('🔄 Inventario toppings actualizado:', payload);
          loadInventoryConSede();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(platosChannel);
      supabase.removeChannel(bebidasChannel);
      supabase.removeChannel(toppingsChannel);
    };
  }, [profile?.sede_id]);

  // Actualizar datos cuando hay cambios en el inventario (tiempo real)
  useEffect(() => {
    loadInventoryConSede();
  }, [lastUpdate, profile?.sede_id]);

  // Contar productos no disponibles
  const unavailablePlatos = platos.filter(plato => !plato.sede_available);
  const unavailableBebidas = bebidas.filter(bebida => !bebida.sede_available);
  const unavailableToppings = toppings.filter(topping => !topping.sede_available);

  // Contar pedidos en curso (received, kitchen, delivery)
  const activeOrders = orders.filter(order => 
    ['received', 'kitchen', 'delivery'].includes(order.status)
  );

  // Calcular total de productos no disponibles
  const totalUnavailable = unavailablePlatos.length + unavailableBebidas.length + unavailableToppings.length;

  // Efecto de parpadeo cuando hay cambios
  useEffect(() => {
    if (totalUnavailable > 0) {
      setIsBlinking(true);
      const timer = setTimeout(() => setIsBlinking(false), 3000); // Parpadea por 3 segundos
      return () => clearTimeout(timer);
    }
  }, [totalUnavailable]);

  // Debug logs
  console.log('🔍 StatusBar Debug:', {
    totalPlatos: platos.length,
    totalBebidas: bebidas.length,
    totalToppings: toppings.length,
    unavailablePlatos: unavailablePlatos.length,
    unavailableBebidas: unavailableBebidas.length,
    unavailableToppings: unavailableToppings.length,
    totalUnavailable,
    activeOrders: activeOrders.length
  });

  // Debug detallado de productos
  console.log('📊 Productos disponibles:', {
    platos: platos.map(p => ({ id: p.id, name: p.name, available: p.sede_available })),
    bebidas: bebidas.map(b => ({ id: b.id, name: b.name, available: b.sede_available })),
    toppings: toppings.map(t => ({ id: t.id, name: t.name, available: t.sede_available }))
  });

  // Solo mostrar si hay productos no disponibles o pedidos activos
  if (totalUnavailable === 0 && activeOrders.length === 0) {
    console.log('🚫 StatusBar: No hay productos no disponibles ni pedidos activos');
    return null;
  }

  console.log('✅ StatusBar: Mostrando barra de estado');

  return (
    <div className={`bg-amber-50 border-b border-amber-200 ${isBlinking ? 'animate-pulse' : ''}`}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AlertTriangle className={`h-4 w-4 text-amber-600 ${isBlinking ? 'animate-bounce' : ''}`} />
            <span className="text-sm font-medium text-amber-800">
              Resumen Operativo
            </span>
          </div>

          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <span className="flex items-center gap-2">
                  {totalUnavailable > 0 && (
                    <Badge variant="destructive" className="h-5 px-1 text-xs">
                      {totalUnavailable}
                    </Badge>
                  )}
                  {activeOrders.length > 0 && (
                    <Badge variant="default" className="h-5 px-1 text-xs bg-blue-600">
                      {activeOrders.length}
                    </Badge>
                  )}

                  Status
                  <ChevronDown className="h-3 w-3" />
                </span>
              </Button>
            </PopoverTrigger>
            
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Resumen Operativo</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadInventoryConSede()}
                      className="h-6 w-6 p-0"
                      title="Actualizar datos"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Sede Actual */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Sede Actual</span>
                  </div>
                  <p className="text-sm text-blue-700">{currentSede}</p>
                </div>

                {/* Pedidos en Curso */}
                {activeOrders.length > 0 && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900">Pedidos en Curso</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Total:</span>
                        <Badge variant="default" className="bg-green-600">
                          {activeOrders.length}
                        </Badge>
                      </div>
                      <div className="text-xs text-green-600">
                        {activeOrders.filter(o => o.status === 'received').length} recibidos • 
                        {activeOrders.filter(o => o.status === 'kitchen').length} en cocina • 
                        {activeOrders.filter(o => o.status === 'delivery').length} en entrega
                      </div>
                    </div>
                  </div>
                )}

                {/* Productos No Disponibles */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 text-sm">Productos Sin Stock</h4>
                  
                  {/* Platos */}
                  {unavailablePlatos.length > 0 ? (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-red-900">Platos Sin Stock ({unavailablePlatos.length})</span>
                      </div>
                      <div className="space-y-1">
                        {unavailablePlatos.map(plato => (
                          <div key={plato.id} className="text-sm text-red-700">
                            • {plato.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">Platos Sin Stock (0)</span>
                      </div>
                      <div className="text-sm text-green-700">✅ Todos los platos están disponibles</div>
                    </div>
                  )}

                  {/* Bebidas */}
                  {unavailableBebidas.length > 0 ? (
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Coffee className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-orange-900">Bebidas Sin Stock ({unavailableBebidas.length})</span>
                      </div>
                      <div className="space-y-1">
                        {unavailableBebidas.map(bebida => (
                          <div key={bebida.id} className="text-sm text-orange-700">
                            • {bebida.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Coffee className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">Bebidas Sin Stock (0)</span>
                      </div>
                      <div className="text-sm text-green-700">✅ Todas las bebidas están disponibles</div>
                    </div>
                  )}

                  {/* Toppings */}
                  {unavailableToppings.length > 0 ? (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-purple-900">Toppings Sin Stock ({unavailableToppings.length})</span>
                      </div>
                      <div className="space-y-1">
                        {unavailableToppings.map(topping => (
                          <div key={topping.id} className="text-sm text-purple-700">
                            • {topping.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">Toppings Sin Stock (0)</span>
                      </div>
                      <div className="text-sm text-green-700">✅ Todos los toppings están disponibles</div>
                    </div>
                  )}
                </div>


              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}; 