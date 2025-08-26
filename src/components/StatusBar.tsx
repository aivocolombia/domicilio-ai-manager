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
  effectiveSedeId?: string; // Agregar sede efectiva para usar en lugar de profile.sede_id
}

export const StatusBar: React.FC<StatusBarProps> = ({ orders, currentSede = 'Niza', effectiveSedeId }) => {
  const { profile } = useAuth();
  const { lastUpdate } = useInventoryEvents();
  const [isOpen, setIsOpen] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [platos, setPlatos] = useState<PlatoConSede[]>([]);
  const [bebidas, setBebidas] = useState<BebidaConSede[]>([]);
  const [toppings, setToppings] = useState<ToppingConSede[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determinar qué sede usar (efectiva o del perfil)
  const sedeToUse = effectiveSedeId || profile?.sede_id;

  // Función para cargar el inventario con información de sede
  const loadInventoryConSede = async (retryCount = 0) => {
    if (!sedeToUse) {
      console.log('⚠️ StatusBar: No hay sede disponible (efectiva o asignada)', { effectiveSedeId, profileSedeId: profile?.sede_id });
      return;
    }

    try {
      if (retryCount === 0) {
        setLoading(true);
        setError(null);
      }
      console.log('🔍 StatusBar: Cargando inventario para sede:', sedeToUse, retryCount > 0 ? `(retry ${retryCount})` : '');
      const menuData = await menuService.getMenuConSede(sedeToUse);
      
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

  // Cargar datos inicialmente y cuando cambia la sede
  useEffect(() => {
    if (sedeToUse) {
      console.log('🔄 StatusBar: Cargando inventario inicial/cambio de sede:', sedeToUse);
      loadInventoryConSede();
    }
  }, [sedeToUse]);

  // Recargar datos cuando se abre el popover
  useEffect(() => {
    if (isOpen && sedeToUse) {
      loadInventoryConSede();
    }
  }, [isOpen]);

  // Suscripción en tiempo real a cambios de inventario (reemplaza polling)
  useEffect(() => {
    if (!sedeToUse) return;

    console.log('🔍 StatusBar: Configurando suscripciones en tiempo real para sede:', sedeToUse);

    // Suscripción a cambios en platos_sedes
    const platosChannel = supabase
      .channel('platos_sedes_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'platos_sedes',
          filter: `sede_id=eq.${sedeToUse}`
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
          filter: `sede_id=eq.${sedeToUse}`
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
          filter: `sede_id=eq.${sedeToUse}`
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
  }, [sedeToUse]);

  // Actualizar datos cuando hay cambios en el inventario (tiempo real)
  useEffect(() => {
    if (sedeToUse) {
      loadInventoryConSede();
    }
  }, [lastUpdate, sedeToUse]);

  // Contar productos no disponibles
  const unavailablePlatos = platos.filter(plato => !plato.sede_available);
  const unavailableBebidas = bebidas.filter(bebida => !bebida.sede_available);
  const unavailableToppings = toppings.filter(topping => !topping.sede_available);

  // Contar pedidos en curso (received, kitchen, delivery) - excluye delivered y cancelled
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
    activeOrders: activeOrders.length,
    allOrdersCount: orders.length,
    orderStatuses: orders.map(o => o.status)
  });

  // Debug detallado de productos
  console.log('📊 Productos disponibles:', {
    platos: platos.map(p => ({ id: p.id, name: p.name, available: p.sede_available })),
    bebidas: bebidas.map(b => ({ id: b.id, name: b.name, available: b.sede_available })),
    toppings: toppings.map(t => ({ id: t.id, name: t.name, available: t.sede_available }))
  });

  // Solo mostrar si hay productos no disponibles o pedidos activos
  if (totalUnavailable === 0 && activeOrders.length === 0) {
    console.log('✅ StatusBar: Todo operativo - productos disponibles, sin pedidos pendientes');
    // Aún así mostrar el StatusBar para indicar que todo está bien
  }
  
  // Solo no mostrar si realmente no hay datos
  if (!loading && !error && platos.length === 0 && bebidas.length === 0) {
    console.log('🚫 StatusBar: No hay datos de inventario para mostrar');
    return null;
  }

  console.log('✅ StatusBar: Mostrando barra de estado');

  // Determinar color de fondo basado en el estado
  const bgColorClass = (() => {
    if (totalUnavailable > 0) {
      return 'bg-red-50 border-b border-red-200'; // Crítico: faltantes de inventario
    }
    if (activeOrders.length > 0) {
      return 'bg-blue-50 border-b border-blue-200'; // Actividad: pedidos en curso
    }
    return 'bg-green-50 border-b border-green-200'; // OK: todo funcionando
  })();

  return (
    <div className={`${bgColorClass} ${isBlinking ? 'animate-pulse' : ''}`}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {(() => {
              // Mostrar icono crítico si hay faltantes
              if (totalUnavailable > 0) {
                return <AlertTriangle className={`h-4 w-4 text-red-600 ${isBlinking ? 'animate-bounce' : ''}`} />;
              }
              // Mostrar icono de actividad si hay pedidos en curso pero inventario OK
              if (activeOrders.length > 0) {
                return <ShoppingCart className="h-4 w-4 text-blue-600" />;
              }
              // Mostrar icono OK si todo está bien
              return <Store className="h-4 w-4 text-green-600" />;
            })()}
            <span className={`text-sm font-medium ${
              totalUnavailable > 0 
                ? 'text-red-800' 
                : activeOrders.length > 0 
                  ? 'text-blue-800'
                  : 'text-green-800'
            }`}>
              {(() => {
                if (totalUnavailable > 0) {
                  const items = [];
                  if (unavailablePlatos.length > 0) items.push(`${unavailablePlatos.length} platos`);
                  if (unavailableBebidas.length > 0) items.push(`${unavailableBebidas.length} bebidas`);
                  if (unavailableToppings.length > 0) items.push(`${unavailableToppings.length} toppings`);
                  return `⚠️ Sin stock: ${items.join(', ')} - ${currentSede}`;
                }
                if (activeOrders.length > 0) {
                  return `🔄 ${activeOrders.length} pedidos en curso - ${currentSede}`;
                }
                return `✅ Todo operativo - ${currentSede}`;
              })()}
            </span>
          </div>

          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={`h-8 bg-white ${
                  (totalUnavailable === 0 && activeOrders.length === 0) 
                    ? 'border-green-300 text-green-700 hover:bg-green-50' 
                    : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  {/* Mostrar resumen de faltantes */}
                  {unavailablePlatos.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-1 text-xs">
                      {unavailablePlatos.length} platos
                    </Badge>
                  )}
                  {unavailableBebidas.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-1 text-xs bg-orange-600">
                      {unavailableBebidas.length} bebidas
                    </Badge>
                  )}
                  {unavailableToppings.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-1 text-xs bg-purple-600">
                      {unavailableToppings.length} toppings
                    </Badge>
                  )}
                  
                  {/* Mostrar pedidos activos */}
                  {activeOrders.length > 0 && (
                    <Badge variant="default" className="h-5 px-1 text-xs bg-blue-600">
                      {activeOrders.length} activos
                    </Badge>
                  )}
                  
                  {/* Estado OK cuando todo está bien */}
                  {(totalUnavailable === 0 && activeOrders.length === 0 && platos.length > 0) && (
                    <Badge variant="default" className="h-5 px-1 text-xs bg-green-600">
                      ✓ Todo OK
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

                {/* Resumen de Sede */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Sede Actual</span>
                  </div>
                  <p className="text-sm text-blue-700 font-medium">{currentSede}</p>
                  <div className="mt-2 text-xs text-blue-600">
                    {platos.length} platos • {bebidas.length} bebidas • {toppings.length} toppings
                  </div>
                </div>

                {/* Estado de Pedidos */}
                <div className={`mb-4 p-3 ${activeOrders.length > 0 ? 'bg-blue-50' : 'bg-green-50'} rounded-lg`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className={`h-4 w-4 ${activeOrders.length > 0 ? 'text-blue-600' : 'text-green-600'}`} />
                    <span className={`font-medium ${activeOrders.length > 0 ? 'text-blue-900' : 'text-green-900'}`}>
                      {activeOrders.length > 0 ? 'Pedidos en Curso' : 'Estado de Pedidos'}
                    </span>
                  </div>
                  {activeOrders.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Total activos:</span>
                        <Badge variant="default" className="bg-blue-600">
                          {activeOrders.length}
                        </Badge>
                      </div>
                      <div className="text-xs text-blue-600">
                        {(() => {
                          const received = activeOrders.filter(o => o.status === 'received').length;
                          const kitchen = activeOrders.filter(o => o.status === 'kitchen').length;
                          const delivery = activeOrders.filter(o => o.status === 'delivery').length;
                          return `${received} recibidos • ${kitchen} en cocina • ${delivery} en entrega`;
                        })()
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-green-700">
                      ✅ No hay pedidos pendientes
                      <div className="text-xs text-green-600 mt-1">
                        Total de órdenes hoy: {orders.length}
                      </div>
                    </div>
                  )}
                </div>

                {false && (
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
                        {(() => {
                          const received = activeOrders.filter(o => o.status === 'received').length;
                          const kitchen = activeOrders.filter(o => o.status === 'kitchen').length;
                          const delivery = activeOrders.filter(o => o.status === 'delivery').length;
                          const total = received + kitchen + delivery;
                          console.log('📊 Order breakdown:', { received, kitchen, delivery, total, activeOrdersLength: activeOrders.length });
                          return `${received} recibidos • ${kitchen} en cocina • ${delivery} en entrega`;
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Estado del Inventario */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 text-sm">
                    {totalUnavailable > 0 ? 'Productos Sin Stock' : 'Estado del Inventario'}
                  </h4>
                  
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
                        <span className="font-medium text-green-900">Platos Disponibles ({platos.length})</span>
                      </div>
                      <div className="text-sm text-green-700">
                        ✅ {platos.length === 0 ? 'No hay platos configurados' : `Todos los platos (${platos.length}) están disponibles`}
                        {platos.length > 0 && (
                          <div className="mt-1 text-xs text-green-600">
                            {platos.slice(0, 3).map(p => p.name).join(' • ')}
                            {platos.length > 3 && ` • +${platos.length - 3} más`}
                          </div>
                        )}
                      </div>
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
                        <span className="font-medium text-green-900">Bebidas Disponibles ({bebidas.length})</span>
                      </div>
                      <div className="text-sm text-green-700">
                        ✅ {bebidas.length === 0 ? 'No hay bebidas configuradas' : `Todas las bebidas (${bebidas.length}) están disponibles`}
                        {bebidas.length > 0 && (
                          <div className="mt-1 text-xs text-green-600">
                            {bebidas.slice(0, 3).map(b => b.name).join(' • ')}
                            {bebidas.length > 3 && ` • +${bebidas.length - 3} más`}
                          </div>
                        )}
                      </div>
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
                        <span className="font-medium text-green-900">Toppings Disponibles ({toppings.length})</span>
                      </div>
                      <div className="text-sm text-green-700">
                        ✅ {toppings.length === 0 ? 'No hay toppings configurados' : `Todos los toppings (${toppings.length}) están disponibles`}
                        {toppings.length > 0 && (
                          <div className="mt-1 text-xs text-green-600">
                            {toppings.slice(0, 4).map(t => t.name).join(' • ')}
                            {toppings.length > 4 && ` • +${toppings.length - 4} más`}
                          </div>
                        )}
                      </div>
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