import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, Minus, Navigation } from 'lucide-react';
import { DashboardOrder } from '@/services/dashboardService';
import { useMenu } from '@/hooks/useMenu';
import { addressService } from '@/services/addressService';
import { supabase } from '@/lib/supabase';
import { sedeService } from '@/services/sedeService';

interface OrderItem {
  id: string;
  tipo: 'plato' | 'bebida' | 'topping';
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  producto_id: number;
}

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  order: DashboardOrder | null;
  onOrderUpdated: () => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  orderId,
  order,
  onOrderUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [searchingPrice, setSearchingPrice] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [sedeAddress, setSedeAddress] = useState<string>('');
  const [sedeId, setSedeId] = useState<string>('');

  // Estado para productos específicos de sede (disponibles)
  const [sedeProducts, setSedeProducts] = useState({
    platos: [] as any[],
    bebidas: [] as any[],
    toppings: [] as any[]
  });
  const [loadingSedeProducts, setLoadingSedeProducts] = useState(false);

  const { platos, bebidas, toppings } = useMenu();

  // Debug de productos de sede
  useEffect(() => {
    console.log('🔍 EditOrderModal: Productos de sede cargados:', sedeProducts);
  }, [sedeProducts]);

  // Funciones para agregar productos
  const handleAddPlato = (plato: { id: number; name: string; pricing?: number }) => {
    const newItem: OrderItem = {
      id: `new_plato_${Date.now()}_${Math.random()}`,
      tipo: 'plato',
      nombre: plato.name,
      cantidad: 1,
      precio_unitario: plato.pricing || 0,
      precio_total: plato.pricing || 0,
      producto_id: plato.id
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleAddBebida = (bebida: { id: number; name: string; pricing?: number }) => {
    const newItem: OrderItem = {
      id: `new_bebida_${Date.now()}_${Math.random()}`,
      tipo: 'bebida',
      nombre: bebida.name,
      cantidad: 1,
      precio_unitario: bebida.pricing || 0,
      precio_total: bebida.pricing || 0,
      producto_id: bebida.id
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleAddTopping = (topping: { id: number; name: string; pricing?: number }) => {
    const newItem: OrderItem = {
      id: `new_topping_${Date.now()}_${Math.random()}`,
      tipo: 'topping',
      nombre: topping.name,
      cantidad: 1,
      precio_unitario: topping.pricing || 0,
      precio_total: topping.pricing || 0,
      producto_id: topping.id
    };
    setItems(prev => [...prev, newItem]);
  };

  // Funciones para manejar cantidades y eliminar items
  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            cantidad: newQuantity, 
            precio_total: item.precio_unitario * newQuantity 
          }
        : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Función para normalizar direcciones (usa la misma que addressService)
  const normalizeAddress = (address: string) => {
    return addressService.normalizeAddress(address);
  };

  // Función para abrir Google Maps
  const openGoogleMaps = () => {
    if (!newAddress.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar una dirección para calcular la ruta",
        variant: "destructive"
      });
      return;
    }

    if (!sedeAddress) {
      toast({
        title: "Error",
        description: "No se pudo obtener la dirección de la sede",
        variant: "destructive"
      });
      return;
    }

    const orderAddress = newAddress.trim();

    const googleMapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(sedeAddress)}/${encodeURIComponent(orderAddress)}`;
    window.open(googleMapsUrl, '_blank');
  };

  // Función para buscar precio de delivery basado en dirección
  const searchDeliveryPrice = useCallback(async (address: string) => {
    if (!address.trim() || address.length < 5 || !order?.sede_id) {
      return;
    }

    try {
      setSearchingPrice(true);
      console.log('🔍 EditOrder: Buscando precio para dirección:', address);
      
      const lastPrice = await addressService.getLastDeliveryPriceForAddress(address, order.sede_id);
      
      if (lastPrice && lastPrice > 0) {
        console.log('✅ EditOrder: Precio encontrado:', lastPrice);
        setDeliveryCost(lastPrice);
        toast({
          title: "Precio encontrado",
          description: `Se estableció $${lastPrice.toLocaleString()} basado en entregas anteriores`,
        });
      } else {
        console.log('ℹ️ EditOrder: No se encontró precio previo para esta dirección');
      }
    } catch (error) {
      console.error('❌ EditOrder: Error buscando precio:', error);
    } finally {
      setSearchingPrice(false);
    }
  }, [order?.sede_id]);

  // Efecto para buscar precio cuando cambia la dirección (con debounce)
  useEffect(() => {
    if (newAddress) {
      const timeout = setTimeout(() => {
        searchDeliveryPrice(newAddress);
      }, 800);

      return () => clearTimeout(timeout);
    }
  }, [newAddress, searchDeliveryPrice]);

  // Cargar sede info y productos cuando se abre el modal
  useEffect(() => {
    const loadSedeInfo = async () => {
      if (!isOpen || !order) return;

      try {
        // Obtener la sede del dashboard order
        const { data: orderData, error } = await supabase
          .from('ordenes')
          .select('sede_id')
          .eq('id', order.orden_id)
          .single();

        if (!error && orderData?.sede_id) {
          setSedeId(orderData.sede_id);

          const sedeInfo = await sedeService.getSedeById(orderData.sede_id);
          if (sedeInfo) {
            setSedeAddress(sedeInfo.address);
          }

          // Cargar productos específicos de sede
          await loadSedeProducts(orderData.sede_id);
        }
      } catch (error) {
        console.error('Error loading sede info:', error);
      }
    };

    loadSedeInfo();
  }, [isOpen, order]);

  // Función para cargar productos específicos de sede
  const loadSedeProducts = async (sedeId: string) => {
    setLoadingSedeProducts(true);
    try {
      console.log('🏢 EditOrderModal: Cargando productos para sede:', sedeId);

      const { platos, bebidas, toppings } = await sedeService.getSedeCompleteInfo(sedeId, true);

      // Filtrar solo productos disponibles en la sede
      const availablePlatos = platos.filter(p => p.is_available);
      const availableBebidas = bebidas.filter(b => b.is_available);
      const availableToppings = toppings.filter(t => t.is_available);

      setSedeProducts({
        platos: availablePlatos,
        bebidas: availableBebidas,
        toppings: availableToppings
      });

      console.log('✅ EditOrderModal: Productos de sede cargados:', {
        platos: availablePlatos.length,
        bebidas: availableBebidas.length,
        toppings: availableToppings.length
      });
    } catch (error) {
      console.error('❌ EditOrderModal: Error cargando productos de sede:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos disponibles para esta sede.",
        variant: "destructive"
      });
    } finally {
      setLoadingSedeProducts(false);
    }
  };

  // Cargar datos reales de la orden al abrir
  useEffect(() => {
    const loadOrderItems = async () => {
      if (!isOpen || !order || !orderId) return;

      try {
        setLoading(true);
        
        // Cargar platos de la orden
        const { data: platosData, error: platosError } = await supabase
          .from('ordenes_platos')
          .select(`
            id,
            plato_id,
            platos!inner(id, name, pricing)
          `)
          .eq('orden_id', orderId);

        if (platosError) {
          console.error('❌ Error obteniendo platos:', platosError);
        }

        // Cargar bebidas de la orden
        const { data: bebidasData, error: bebidasError } = await supabase
          .from('ordenes_bebidas')
          .select(`
            id,
            bebidas_id,
            bebidas!inner(id, name, pricing)
          `)
          .eq('orden_id', orderId);

        if (bebidasError) {
          console.error('❌ Error obteniendo bebidas:', bebidasError);
        }
        
        // Cargar toppings de la orden
        const { data: toppingsData, error: toppingsError } = await supabase
          .from('ordenes_toppings')
          .select(`
            id,
            topping_id,
            toppings!inner(id, name, pricing)
          `)
          .eq('orden_id', orderId);

        if (toppingsError) {
          console.error('❌ Error obteniendo toppings:', toppingsError);
        }
        
        // Agrupar items por producto para contar cantidades
        const itemsMap = new Map<string, OrderItem>();
        
        // Procesar platos
        (platosData || []).forEach(item => {
          if (item.platos) {
            const platoId = item.plato_id || item.platos.id;
            const key = `plato_${platoId}`;
            if (itemsMap.has(key)) {
              const existing = itemsMap.get(key)!;
              existing.cantidad++;
              existing.precio_total = existing.precio_unitario * existing.cantidad;
            } else {
              itemsMap.set(key, {
                id: key,
                tipo: 'plato',
                nombre: item.platos.name,
                cantidad: 1,
                precio_unitario: item.platos.pricing || 0,
                precio_total: item.platos.pricing || 0,
                producto_id: item.platos.id
              });
            }
          }
        });

        // Procesar bebidas
        (bebidasData || []).forEach(item => {
          if (item.bebidas) {
            const key = `bebida_${item.bebidas.id}`;
            if (itemsMap.has(key)) {
              const existing = itemsMap.get(key)!;
              existing.cantidad++;
              existing.precio_total = existing.precio_unitario * existing.cantidad;
            } else {
              itemsMap.set(key, {
                id: key,
                tipo: 'bebida',
                nombre: item.bebidas.name,
                cantidad: 1,
                precio_unitario: item.bebidas.pricing || 0,
                precio_total: item.bebidas.pricing || 0,
                producto_id: item.bebidas.id
              });
            }
          }
        });
        
        // Procesar toppings
        (toppingsData || []).forEach(item => {
          if (item.toppings) {
            const key = `topping_${item.toppings.id}`;
            if (itemsMap.has(key)) {
              const existing = itemsMap.get(key)!;
              existing.cantidad++;
              existing.precio_total = existing.precio_unitario * existing.cantidad;
            } else {
              itemsMap.set(key, {
                id: key,
                tipo: 'topping',
                nombre: item.toppings.name,
                cantidad: 1,
                precio_unitario: item.toppings.pricing || 0,
                precio_total: item.toppings.pricing || 0,
                producto_id: item.toppings.id
              });
            }
          }
        });
        
        const finalItems = Array.from(itemsMap.values());
        console.log('🔍 EditOrderModal: Items procesados:', {
          platosData: platosData?.length || 0,
          bebidasData: bebidasData?.length || 0,
          toppingsData: toppingsData?.length || 0,
          finalItems: finalItems.length,
          itemsDetailed: finalItems
        });

        // Debug detallado para troubleshooting
        console.log('🔍 EditOrderModal: Raw data debug:', {
          platosRaw: platosData,
          bebidasRaw: bebidasData,
          toppingsRaw: toppingsData
        });

        // Verificar si hay datos y qué estructura tienen
        if (platosData && platosData.length > 0) {
          console.log('🍽️ EditOrderModal: Primer plato estructura:', platosData[0]);
        }
        if (bebidasData && bebidasData.length > 0) {
          console.log('🥤 EditOrderModal: Primera bebida estructura:', bebidasData[0]);
        }
        if (toppingsData && toppingsData.length > 0) {
          console.log('🧀 EditOrderModal: Primer topping estructura:', toppingsData[0]);
        }

        setItems(finalItems);
        setNewAddress(order.address || '');
        setDeliveryCost(order.precio_envio || 0);
        
      } catch (error) {
        console.error('Error cargando items de la orden:', error);
        toast({
          title: "Error",
          description: "Error cargando los productos de la orden",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadOrderItems();
  }, [isOpen, order, orderId]);

  // Calcular total cuando cambian items o delivery cost
  useEffect(() => {
    const itemsTotal = items.reduce((sum, item) => sum + item.precio_total, 0);
    setTotalAmount(itemsTotal + deliveryCost);
  }, [items, deliveryCost]);

  const handleSaveChanges = async () => {
    if (!order || !orderId) return;

    try {
      setLoading(true);
      
      // 1. Actualizar dirección del cliente y de la orden si cambió
      if (newAddress.trim() && newAddress !== order.address) {
        // Actualizar dirección del cliente para futuras órdenes
        const { error: clientError } = await supabase
          .from('clientes')
          .update({ direccion: newAddress })
          .eq('telefono', order.cliente_telefono);

        if (clientError) {
          console.error('Error actualizando dirección del cliente:', clientError);
          throw new Error('Error actualizando dirección del cliente');
        }

        // Actualizar dirección específica de esta orden
        const { error: orderAddressError } = await supabase
          .from('ordenes')
          .update({ address: newAddress })
          .eq('id', orderId);

        if (orderAddressError) {
          console.error('Error actualizando dirección de la orden:', orderAddressError);
          throw new Error('Error actualizando dirección de la orden');
        }
      }

      // 2. Actualizar precio de envío si cambió
      if (deliveryCost !== order.precio_envio) {
        const { error: orderError } = await supabase
          .from('ordenes')
          .update({ precio_envio: deliveryCost })
          .eq('id', orderId);
        
        if (orderError) {
          console.error('Error actualizando precio de envío:', orderError);
          throw new Error('Error actualizando precio de envío');
        }
      }

      // 3. Obtener payment_id de la orden y actualizar total de pago
      const { data: ordenData, error: ordenDataError } = await supabase
        .from('ordenes')
        .select('payment_id')
        .eq('id', orderId)
        .single();
      
      if (ordenDataError || !ordenData?.payment_id) {
        console.error('Error obteniendo payment_id:', ordenDataError);
        throw new Error('Error obteniendo información de pago');
      }

      const { error: paymentError } = await supabase
        .from('pagos')
        .update({ total_pago: totalAmount })
        .eq('id', ordenData.payment_id);
      
      if (paymentError) {
        console.error('Error actualizando total:', paymentError);
        throw new Error('Error actualizando total de pago');
      }

      // 4. Eliminar todos los items existentes
      await Promise.all([
        supabase.from('ordenes_platos').delete().eq('orden_id', orderId),
        supabase.from('ordenes_bebidas').delete().eq('orden_id', orderId),
        supabase.from('ordenes_toppings').delete().eq('orden_id', orderId)
      ]);

      // 5. Insertar los nuevos items
      const platos = items.filter(item => item.tipo === 'plato');
      const bebidas = items.filter(item => item.tipo === 'bebida');
      const toppings = items.filter(item => item.tipo === 'topping');

      // Insertar platos
      for (const plato of platos) {
        for (let i = 0; i < plato.cantidad; i++) {
          await supabase
            .from('ordenes_platos')
            .insert({ orden_id: orderId, plato_id: plato.producto_id });
        }
      }

      // Insertar bebidas
      for (const bebida of bebidas) {
        for (let i = 0; i < bebida.cantidad; i++) {
          await supabase
            .from('ordenes_bebidas')
            .insert({ orden_id: orderId, bebidas_id: bebida.producto_id });
        }
      }

      // Insertar toppings
      for (const topping of toppings) {
        for (let i = 0; i < topping.cantidad; i++) {
          await supabase
            .from('ordenes_toppings')
            .insert({ orden_id: orderId, topping_id: topping.producto_id });
        }
      }
      
      toast({
        title: "Orden actualizada",
        description: "Los cambios se han guardado correctamente",
      });

      onOrderUpdated();
      onClose();
    } catch (error) {
      console.error('Error actualizando orden:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al actualizar la orden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Orden {order.id_display}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <Input value={order.cliente_nombre} disabled />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={order.cliente_telefono} disabled />
                </div>
              </div>
              
              <div>
                <Label>Dirección de Entrega (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Ingresa la nueva dirección"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={openGoogleMaps}
                    disabled={!newAddress.trim()}
                    title="Abrir en Google Maps para calcular ruta"
                  >
                    <Navigation className="h-4 w-4" />
                  </Button>
                  {searchingPrice && (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Costo de Envío</Label>
                <Input 
                  type="number"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items de la orden */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Productos de la Orden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.nombre}</div>
                      <div className="text-sm text-gray-600">
                        ${item.precio_unitario.toLocaleString()} c/u
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {item.tipo === 'plato' ? '🍽️ Plato' : 
                         item.tipo === 'bebida' ? '🥤 Bebida' : '🧀 Topping'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuantityChange(item.id, item.cantidad - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <span className="mx-2 font-medium">{item.cantidad}</span>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuantityChange(item.id, item.cantidad + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveItem(item.id)}
                        className="ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="ml-4 text-right">
                      <div className="font-medium">
                        ${item.precio_total.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                
                {items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay productos en esta orden
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agregar Platos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🍽️ Agregar Platos</CardTitle>
              {loadingSedeProducts && (
                <div className="text-sm text-gray-500">Cargando platos disponibles...</div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {sedeProducts.platos.map((plato) => (
                  <div key={plato.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{plato.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      ${plato.pricing?.toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddPlato(plato)}
                      className="w-full"
                      disabled={loadingSedeProducts}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                ))}
                {sedeProducts.platos.length === 0 && !loadingSedeProducts && (
                  <div className="col-span-full text-center py-4 text-gray-500">
                    No hay platos disponibles para esta sede
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agregar Bebidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🥤 Agregar Bebidas</CardTitle>
              {loadingSedeProducts && (
                <div className="text-sm text-gray-500">Cargando bebidas disponibles...</div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {sedeProducts.bebidas.map((bebida) => (
                  <div key={bebida.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{bebida.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      ${bebida.pricing?.toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddBebida(bebida)}
                      className="w-full"
                      disabled={loadingSedeProducts}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                ))}
                {sedeProducts.bebidas.length === 0 && !loadingSedeProducts && (
                  <div className="col-span-full text-center py-4 text-gray-500">
                    No hay bebidas disponibles para esta sede
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agregar Toppings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-orange-600">🧀 Agregar Toppings Extra</CardTitle>
              {loadingSedeProducts && (
                <div className="text-sm text-gray-500">Cargando toppings disponibles...</div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {sedeProducts.toppings.map((topping) => (
                  <div key={topping.id} className="border border-orange-200 rounded-lg p-3">
                    <div className="font-medium text-sm">{topping.name}</div>
                    <div className="text-xs text-orange-600 mb-2">
                      ${topping.pricing?.toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddTopping(topping)}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      disabled={loadingSedeProducts}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                ))}
                {sedeProducts.toppings.length === 0 && !loadingSedeProducts && (
                  <div className="col-span-full text-center py-4 text-gray-500">
                    No hay toppings disponibles para esta sede
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Total */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal productos:</span>
                  <span>${(totalAmount - deliveryCost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Costo de envío:</span>
                  <span>${deliveryCost.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};