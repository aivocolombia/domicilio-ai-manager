import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  Coffee, 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  CreditCard,
  Loader2,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface OrderItem {
  id: number;
  quantity: number;
  unit_price: number;
  producto: {
    id: number;
    name: string;
    pricing?: number;
  };
  tipo: 'plato' | 'bebida' | 'topping';
}

interface OrderDetails {
  orden_id: number;
  id_display: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  estado: string;
  total: number;
  created_at: string;
  hora_entrega?: string;
  observaciones?: string;
  cubiertos?: number;
  items: OrderItem[];
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number | null;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId
}) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderDetails = async (id: number) => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Buscando detalles de la orden:', id);

      // Obtener datos básicos de la orden
      const { data: orderData, error: orderError } = await supabase
        .from('ordenes')
        .select(`
          id,
          status,
          created_at,
          hora_entrega,
          observaciones,
          cubiertos,
          address,
          clientes!cliente_id(nombre, telefono),
          pagos!payment_id(total_pago)
        `)
        .eq('id', id)
        .single();

      if (orderError) {
        console.error('❌ Error obteniendo orden:', orderError);
        throw new Error('No se pudo obtener la información de la orden');
      }

      if (!orderData) {
        throw new Error('Orden no encontrada');
      }

      // Obtener items de platos
      const { data: platosData, error: platosError } = await supabase
        .from('ordenes_platos')
        .select(`
          id,
          plato_id,
          platos!plato_id(id, name, pricing)
        `)
        .eq('orden_id', id);

      if (platosError) {
        console.error('❌ Error obteniendo platos:', platosError);
      }

      // Obtener items de bebidas
      const { data: bebidasData, error: bebidasError } = await supabase
        .from('ordenes_bebidas')
        .select(`
          id,
          bebidas_id,
          bebidas!bebidas_id(id, name, pricing)
        `)
        .eq('orden_id', id);

      if (bebidasError) {
        console.error('❌ Error obteniendo bebidas:', bebidasError);
      }

      // Obtener toppings de la orden
      const { data: toppingsData, error: toppingsError } = await supabase
        .from('ordenes_toppings')
        .select(`
          id,
          topping_id,
          toppings!topping_id(id, name, pricing)
        `)
        .eq('orden_id', id);

      if (toppingsError) {
        console.error('❌ Error obteniendo toppings:', toppingsError);
      }

      // Agrupar items por producto para contar cantidades
      const platosMap = new Map<number, { count: number; item: any }>();
      const bebidasMap = new Map<number, { count: number; item: any }>();
      const toppingsMap = new Map<number, { count: number; item: any }>();

      // Contar platos
      (platosData || []).forEach(item => {
        const platoId = item.plato_id || item.platos.id;
        if (platosMap.has(platoId)) {
          platosMap.get(platoId)!.count++;
        } else {
          platosMap.set(platoId, { count: 1, item });
        }
      });

      // Contar bebidas
      (bebidasData || []).forEach(item => {
        const bebidaId = item.bebidas_id || item.bebidas.id;
        if (bebidasMap.has(bebidaId)) {
          bebidasMap.get(bebidaId)!.count++;
        } else {
          bebidasMap.set(bebidaId, { count: 1, item });
        }
      });

      // Contar toppings
      (toppingsData || []).forEach(item => {
        const toppingId = item.topping_id || item.toppings.id;
        if (toppingsMap.has(toppingId)) {
          toppingsMap.get(toppingId)!.count++;
        } else {
          toppingsMap.set(toppingId, { count: 1, item });
        }
      });

      // Combinar items
      const items: OrderItem[] = [
        ...Array.from(platosMap.values()).map(({ count, item }) => ({
          id: item.id,
          quantity: count,
          unit_price: item.platos?.pricing || 0,
          producto: {
            id: item.platos.id,
            name: item.platos.name,
            pricing: item.platos?.pricing || 0
          },
          tipo: 'plato' as const
        })),
        ...Array.from(bebidasMap.values()).map(({ count, item }) => ({
          id: item.id,
          quantity: count,
          unit_price: item.bebidas?.pricing || 0,
          producto: {
            id: item.bebidas.id,
            name: item.bebidas.name,
            pricing: item.bebidas?.pricing || 0
          },
          tipo: 'bebida' as const
        })),
        ...Array.from(toppingsMap.values()).map(({ count, item }) => ({
          id: item.id,
          quantity: count,
          unit_price: item.toppings?.pricing || 0,
          producto: {
            id: item.toppings.id,
            name: item.toppings.name,
            pricing: item.toppings?.pricing || 0
          },
          tipo: 'topping' as const
        }))
      ];

      const details: OrderDetails = {
        orden_id: orderData.id,
        id_display: `ORD-${orderData.id.toString().padStart(4, '0')}`,
        cliente_nombre: orderData.clientes?.nombre || 'Sin nombre',
        cliente_telefono: orderData.clientes?.telefono || 'Sin teléfono',
        direccion: orderData.address || 'Sin dirección',
        estado: orderData.status || 'Desconocido',
        total: orderData.pagos?.total_pago || 0,
        created_at: orderData.created_at,
        hora_entrega: orderData.hora_entrega || undefined,
        observaciones: orderData.observaciones || undefined,
        cubiertos: typeof orderData.cubiertos === 'number' ? orderData.cubiertos : (orderData.cubiertos ? Number(orderData.cubiertos) : 0),
        items
      };

      console.log('✅ Detalles de orden obtenidos:', details);
      console.log('🍽️ Items con precios:', items.map(item => ({
        nombre: item.producto.name,
        precio_unitario: item.unit_price,
        cantidad: item.quantity,
        total: item.unit_price * item.quantity
      })));
      setOrderDetails(details);

    } catch (error) {
      console.error('❌ Error cargando detalles de orden:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles de la orden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails(orderId);
    } else {
      setOrderDetails(null);
      setError(null);
    }
  }, [isOpen, orderId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Recibidos': return 'bg-yellow-500';
      case 'Cocina': return 'bg-blue-500';
      case 'Camino': return 'bg-orange-500';
      case 'Entregados': return 'bg-green-500';
      case 'Cancelado': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Detalles del Pedido
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Cargando detalles...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {orderDetails && !loading && (
          <div className="space-y-6">
            {/* Información básica del pedido */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
                  Información del Pedido
                </h3>
                <div className="space-y-1">
                  <p className="font-mono text-lg font-bold">{orderDetails.id_display}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-white ${getStatusColor(orderDetails.estado)}`}>
                      {orderDetails.estado}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    {formatDateTime(orderDetails.created_at)}
                  </div>
                  {orderDetails.hora_entrega && (
                    <div className="text-sm text-gray-600">
                      <strong>Entrega:</strong> {new Date(orderDetails.hora_entrega).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
                  Información del Cliente
                </h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{orderDetails.cliente_nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{orderDetails.cliente_telefono}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                    <span className="text-sm">{orderDetails.direccion}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Productos ordenados */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos ({orderDetails.items.length})
              </h3>

              {/* Cubiertos */}
              <div className="text-sm text-gray-700">
                <strong>🍴 Cubiertos:</strong> {orderDetails.cubiertos ?? 0}
              </div>

              {orderDetails.items.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay productos en este pedido</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderDetails.items.map((item) => (
                    <div key={`${item.tipo}-${item.id}`} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.tipo === 'plato' ? (
                          <Package className="h-5 w-5 text-orange-600" />
                        ) : item.tipo === 'bebida' ? (
                          <Coffee className="h-5 w-5 text-blue-600" />
                        ) : (
                          <ShoppingBag className="h-5 w-5 text-amber-600" />
                        )}
                        <div>
                          <h4 className="font-medium">{item.producto.name}</h4>
                          <p className="text-sm text-gray-600">
                            {item.tipo === 'plato' ? 'Plato' : 
                             item.tipo === 'bebida' ? 'Bebida' : 
                             'Topping Extra'} • {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">x{item.quantity}</div>
                        <div className="text-sm font-bold text-green-600">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observaciones */}
            {orderDetails.observaciones && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Observaciones</h3>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{orderDetails.observaciones}</p>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between text-lg font-bold">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Total del Pedido:
              </div>
              <div className="text-green-600">
                {formatCurrency(orderDetails.total)}
              </div>
            </div>

            {/* Botón cerrar */}
            <div className="flex justify-end pt-4">
              <Button onClick={onClose} variant="outline">
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};