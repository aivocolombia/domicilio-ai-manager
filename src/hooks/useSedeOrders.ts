import { useState, useCallback } from 'react';
import { sedeOrdersService, CustomerData, SedeOrder, CreateOrderData } from '@/services/sedeOrdersService';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';

export const useSedeOrders = (sedeId?: string) => {
  const [orders, setOrders] = useState<SedeOrder[]>([]);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Buscar cliente por teléfono
  const searchCustomer = useCallback(async (telefono: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 useSedeOrders: Buscando cliente:', telefono);

      const customerData = await sedeOrdersService.searchCustomerByPhone(telefono);
      setCustomer(customerData);

      if (customerData) {
        console.log('✅ Cliente encontrado:', customerData.nombre);
        toast({
          title: "Cliente encontrado",
          description: `${customerData.nombre} - ${customerData.historial_pedidos.length} pedidos anteriores`,
        });
      } else {
        console.log('ℹ️ Cliente no encontrado');
        toast({
          title: "Cliente no encontrado",
          description: "No se encontró ningún cliente con este teléfono",
          variant: "default"
        });
      }

      return customerData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al buscar cliente';
      console.error('❌ Error buscando cliente:', err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Cargar pedidos de la sede
  const loadSedeOrders = useCallback(async (limit?: number) => {
    if (!sedeId) {
      console.log('⚠️ useSedeOrders: No hay sede_id');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('📊 useSedeOrders: Cargando pedidos de sede:', sedeId);

      const sedeOrders = await sedeOrdersService.getSedeOrders(sedeId, limit);
      setOrders(sedeOrders);

      console.log('✅ Pedidos cargados:', sedeOrders.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar pedidos';
      console.error('❌ Error cargando pedidos:', err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [sedeId, toast]);

  // Crear nuevo pedido
  const createOrder = useCallback(async (orderData: CreateOrderData) => {
    try {
      setLoading(true);
      setError(null);
      console.log('📝 useSedeOrders: Creando pedido:', orderData);

      const newOrder = await sedeOrdersService.createOrder(orderData);
      
      // Agregar el nuevo pedido a la lista
      setOrders(prevOrders => [newOrder, ...prevOrders]);

      // Actualizar historial del cliente si existe
      if (customer && customer.telefono === orderData.cliente_telefono) {
        setCustomer(prevCustomer => ({
          ...prevCustomer!,
          historial_pedidos: [newOrder, ...prevCustomer!.historial_pedidos]
        }));
      }

      console.log('✅ Pedido creado exitosamente:', newOrder.id);
      toast({
        title: "Pedido creado",
        description: `Pedido #${newOrder.id} creado exitosamente`,
      });

      return newOrder;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear pedido';
      console.error('❌ Error creando pedido:', err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [customer, toast]);

  // Transferir pedido
  const transferOrder = useCallback(async (orderId: number, targetSedeId: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useSedeOrders: Transfiriendo pedido:', orderId, 'a', targetSedeId);

      await sedeOrdersService.transferOrder(orderId, targetSedeId);

      // Remover el pedido de la lista actual
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));

      console.log('✅ Pedido transferido exitosamente');
      toast({
        title: "Pedido transferido",
        description: `Pedido #${orderId} transferido exitosamente`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al transferir pedido';
      console.error('❌ Error transfiriendo pedido:', err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Limpiar cliente
  const clearCustomer = useCallback(() => {
    setCustomer(null);
  }, []);

  // Limpiar error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Configurar suscripción en tiempo real
  useRealtimeOrders({
    sedeId,
    onOrderUpdated: () => {
      console.log('🔄 SedeOrders: Orden actualizada, recargando datos...');
      if (sedeId) {
        loadSedeOrders();
      }
    },
    onNewOrder: (order) => {
      console.log('📝 SedeOrders: Nueva orden recibida:', order);
      // Agregar directamente a la lista local para actualización inmediata
      if (order.sede_id === sedeId) {
        toast({
          title: "Nueva orden",
          description: `Orden #${order.id} recibida`,
        });
        // Recargar para obtener datos completos
        if (sedeId) {
          loadSedeOrders();
        }
      }
    },
    onOrderStatusChanged: (orderId, newStatus) => {
      console.log(`📊 SedeOrders: Orden #${orderId} cambió a ${newStatus}`);
    }
  });

  return {
    orders,
    customer,
    loading,
    error,
    searchCustomer,
    loadSedeOrders,
    createOrder,
    transferOrder,
    clearCustomer,
    clearError
  };
};