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
import { substitutionHistoryService, type SubstitutionHistoryRecord } from '@/services/substitutionHistoryService';

interface OrderItem {
  id: number;
  quantity: number;
  unit_price: number;
  orden_item_id: number; // ID único del item en ordenes_platos/bebidas/toppings
  producto: {
    id: number;
    name: string;
    pricing?: number;
  };
  tipo: 'plato' | 'bebida' | 'topping';
  substitutions?: Array<{
    type: 'product_substitution' | 'topping_substitution';
    original_name: string;
    substitute_name: string;
    price_difference: number;
    parent_item_name?: string;
  }>;
}

interface OrderDetails {
  orden_id: number;
  id_display: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  direccion_indicaciones?: string;
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
  const [substitutionHistory, setSubstitutionHistory] = useState<SubstitutionHistoryRecord[]>([]);

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
          delivery_instructions,
          payment_id_2,
          clientes!cliente_id(nombre, telefono),
          pagos!payment_id(total_pago),
          pagos2:pagos!payment_id_2(total_pago)
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

      // NUEVO: Mantener items individuales sin agrupar
      const items: OrderItem[] = [
        // Procesar platos individualmente
        ...(platosData || []).map(item => ({
          id: item.platos.id,
          orden_item_id: item.id, // ID único del item en ordenes_platos
          quantity: 1, // Siempre 1 para items individuales
          unit_price: item.platos?.pricing || 0,
          producto: {
            id: item.platos.id,
            name: item.platos.name,
            pricing: item.platos?.pricing || 0
          },
          tipo: 'plato' as const
        })),
        // Procesar bebidas individualmente
        ...(bebidasData || []).map(item => ({
          id: item.bebidas.id,
          orden_item_id: item.id, // ID único del item en ordenes_bebidas
          quantity: 1, // Siempre 1 para items individuales
          unit_price: item.bebidas?.pricing || 0,
          producto: {
            id: item.bebidas.id,
            name: item.bebidas.name,
            pricing: item.bebidas?.pricing || 0
          },
          tipo: 'bebida' as const
        })),
        // Procesar toppings individualmente
        ...(toppingsData || []).map(item => ({
          id: item.toppings.id,
          orden_item_id: item.id, // ID único del item en ordenes_toppings
          quantity: 1, // Siempre 1 para items individuales
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
        direccion_indicaciones: orderData.delivery_instructions || undefined,
        estado: orderData.status || 'Desconocido',
        total: !!orderData.payment_id_2
          ? (orderData.pagos?.total_pago || 0) + (orderData.pagos2?.total_pago || 0)
          : (orderData.pagos?.total_pago || 0),
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

      // Intentar cargar historial de sustituciones (opcional)
      try {
        const history = await substitutionHistoryService.getOrderSubstitutionHistory(id);
        setSubstitutionHistory(history);

        if (history.length > 0) {
          // Mapear el historial a los items específicos usando orden_item_id
          const itemsWithSubstitutions = items.map(item => ({
            ...item,
            substitutions: history
              .filter(sub => {
                console.log(`🔍 OrderDetailsModal: Evaluando substitución para item "${item.producto.name}" (orden_item_id: ${item.orden_item_id}):`, {
                  sub_orden_item_id: sub.orden_item_id,
                  sub_type: sub.substitution_type,
                  sub_original: sub.original_name,
                  sub_substitute: sub.substitute_name,
                  sub_parent: sub.parent_item_name
                });

                // NUEVO: Filtrar por orden_item_id específico si está disponible
                if (sub.orden_item_id && item.orden_item_id) {
                  const match = sub.orden_item_id === item.orden_item_id;
                  console.log(`🎯 OrderDetailsModal: Item ID match: ${match} (${sub.orden_item_id} === ${item.orden_item_id})`);
                  return match;
                }

                console.log(`⚠️ OrderDetailsModal: Usando fallback - sub.orden_item_id: ${sub.orden_item_id}, item.orden_item_id: ${item.orden_item_id}`);
                // FALLBACK: Usar lógica anterior para compatibilidad
                return sub.substitution_type === 'product_substitution' ||
                       (sub.substitution_type === 'topping_substitution' && sub.parent_item_name === item.producto.name);
              })
              .map(sub => ({
                type: sub.substitution_type,
                original_name: sub.original_name,
                substitute_name: sub.substitute_name,
                price_difference: sub.price_difference,
                parent_item_name: sub.parent_item_name
              }))
          }));
          setOrderDetails({ ...details, items: itemsWithSubstitutions });
        } else {
          // Si no hay historial, mostrar mensaje informativo
          const itemsWithInfo = items.map(item => {
            const hasUnexpectedPrice = item.producto.pricing &&
                                     Math.abs(item.unit_price - item.producto.pricing) > 0;
            return {
              ...item,
              substitutions: hasUnexpectedPrice ? [{
                type: 'product_substitution' as const,
                original_name: 'Producto original',
                substitute_name: item.producto.name,
                price_difference: item.unit_price - (item.producto.pricing || 0),
                parent_item_name: undefined
              }] : []
            };
          });
          setOrderDetails({ ...details, items: itemsWithInfo });
        }
      } catch (error) {
        // Si falla el historial, mostrar items normales
        setOrderDetails(details);
      }

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
      setSubstitutionHistory([]);
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
                    <div className="flex flex-col">
                      <span className="text-sm">{orderDetails.direccion}</span>
                      {orderDetails.direccion_indicaciones && (
                        <span className="text-xs text-gray-600 mt-1">
                          {orderDetails.direccion_indicaciones}
                        </span>
                      )}
                    </div>
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
                    <div key={`${item.tipo}-${item.orden_item_id}`} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
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

                          {/* Mostrar sustituciones si existen */}
                          {item.substitutions && item.substitutions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.substitutions.map((substitution, idx) => (
                                <div key={idx} className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                  {substitution.type === 'topping_substitution' ? (
                                    <span>
                                      🔄 <strong>Topping cambiado:</strong> {substitution.original_name} → {substitution.substitute_name}
                                      {substitution.price_difference !== 0 && (
                                        <span className={substitution.price_difference > 0 ? 'text-red-600' : 'text-green-600'}>
                                          {' '}({substitution.price_difference > 0 ? '+' : ''}{formatCurrency(substitution.price_difference)})
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span>
                                      {substitution.original_name === 'Producto original' ? (
                                        <span>🔄 <strong>Producto modificado:</strong> {substitution.substitute_name}</span>
                                      ) : (
                                        <span>
                                          🔄 <strong>Producto cambiado:</strong> {substitution.original_name} → {substitution.substitute_name}
                                          {substitution.price_difference !== 0 && (
                                            <span className={substitution.price_difference > 0 ? 'text-red-600' : 'text-green-600'}>
                                              {' '}({substitution.price_difference > 0 ? '+' : ''}{formatCurrency(substitution.price_difference)})
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

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