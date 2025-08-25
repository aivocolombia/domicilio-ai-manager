import { supabase } from '@/lib/supabase';

// Interfaces para los datos de pedidos
export interface SedeOrder {
  id: number;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  total: number;
  estado: string;
  pago_tipo: string;
  pago_estado: string;
  tipo_entrega: 'delivery' | 'pickup';
  sede_recogida?: string;
  instrucciones?: string;
  created_at: string;
  updated_at: string;
  sede_id: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: number;
  producto_tipo: 'plato' | 'bebida';
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
}

export interface CustomerData {
  nombre: string;
  telefono: string;
  direccion_reciente?: string;
  historial_pedidos: SedeOrder[];
}

export interface CreateOrderData {
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  tipo_entrega: 'delivery' | 'pickup';
  sede_recogida?: string;
  pago_tipo: 'efectivo' | 'tarjeta' | 'nequi' | 'transferencia';
  instrucciones?: string;
  items: {
    producto_tipo: 'plato' | 'bebida';
    producto_id: number;
    cantidad: number;
  }[];
  sede_id: string;
  // Datos para actualización de cliente
  update_customer_data?: {
    nombre: string;
    telefono: string;
    direccion?: string;
  };
}

class SedeOrdersService {
  // Buscar cliente por teléfono
  async searchCustomerByPhone(telefono: string): Promise<CustomerData | null> {
    try {
      console.log('🔍 SedeOrders: Buscando cliente por teléfono:', telefono);
      
      // Normalizar teléfono (remover espacios, guiones, etc.)
      const normalizedPhone = telefono.replace(/[\s\-()]/g, '');
      
      // Buscar órdenes del cliente
      const { data: ordersData, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          created_at,
          status,
          hora_entrega,
          observaciones,
          clientes!inner(nombre, telefono, direccion),
          pagos!left(type, status, total_pago),
          ordenes_platos!left(
            platos!inner(id, name, pricing)
          ),
          ordenes_bebidas!left(
            bebidas!inner(id, name, pricing)
          )
        `)
        .ilike('clientes.telefono', `%${normalizedPhone}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Error buscando cliente:', error);
        throw error;
      }

      if (!ordersData || ordersData.length === 0) {
        console.log('ℹ️ No se encontró cliente con teléfono:', telefono);
        return null;
      }

      // Procesar los datos
      const customerName = ordersData[0].clientes?.nombre || 'Cliente';
      const customerPhone = ordersData[0].clientes?.telefono || telefono;
      const recentAddress = ordersData[0].clientes?.direccion;

      // Convertir órdenes al formato esperado
      const historialPedidos: SedeOrder[] = ordersData.map(order => {
        // Contar elementos agrupados por producto para obtener cantidades
        const platosMap = new Map();
        const bebidasMap = new Map();
        
        // Procesar platos
        (order.ordenes_platos || []).forEach((item: any) => {
          const platoId = item.platos.id;
          const existing = platosMap.get(platoId);
          if (existing) {
            existing.cantidad += 1;
          } else {
            platosMap.set(platoId, {
              id: platoId,
              producto_tipo: 'plato' as const,
              producto_id: platoId,
              producto_nombre: item.platos.name,
              cantidad: 1,
              precio_unitario: item.platos.pricing,
              precio_total: item.platos.pricing
            });
          }
        });
        
        // Procesar bebidas
        (order.ordenes_bebidas || []).forEach((item: any) => {
          const bebidaId = item.bebidas.id;
          const existing = bebidasMap.get(bebidaId);
          if (existing) {
            existing.cantidad += 1;
          } else {
            bebidasMap.set(bebidaId, {
              id: bebidaId,
              producto_tipo: 'bebida' as const,
              producto_id: bebidaId,
              producto_nombre: item.bebidas.name,
              cantidad: 1,
              precio_unitario: item.bebidas.pricing,
              precio_total: item.bebidas.pricing
            });
          }
        });
        
        // Actualizar precios totales después de contar
        platosMap.forEach(item => {
          item.precio_total = item.precio_unitario * item.cantidad;
        });
        bebidasMap.forEach(item => {
          item.precio_total = item.precio_unitario * item.cantidad;
        });
        
        const items: OrderItem[] = [
          ...Array.from(platosMap.values()),
          ...Array.from(bebidasMap.values())
        ];

        return {
          id: order.id,
          cliente_nombre: customerName,
          cliente_telefono: customerPhone,
          direccion: order.clientes?.direccion || '',
          total: order.pagos?.total_pago || 0,
          estado: order.status || 'unknown',
          pago_tipo: order.pagos?.type || 'efectivo',
          pago_estado: order.pagos?.status || 'pending',
          tipo_entrega: 'delivery', // Por defecto delivery
          instrucciones: order.observaciones,
          created_at: order.created_at,
          updated_at: order.created_at, // Usar created_at ya que updated_at no existe
          sede_id: '', // TODO: Agregar cuando esté disponible
          items
        };
      });

      const customerData: CustomerData = {
        nombre: customerName,
        telefono: customerPhone,
        direccion_reciente: recentAddress,
        historial_pedidos: historialPedidos
      };

      console.log('✅ Cliente encontrado:', customerData.nombre, 'con', historialPedidos.length, 'pedidos');
      return customerData;

    } catch (error) {
      console.error('❌ Error en searchCustomerByPhone:', error);
      throw error;
    }
  }

  // Obtener pedidos de una sede específica
  async getSedeOrders(sedeId: string, limit: number = 50): Promise<SedeOrder[]> {
    try {
      console.log('📊 SedeOrders: Obteniendo pedidos de sede:', sedeId);

      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          status,
          created_at,
          observaciones,
          clientes!inner(nombre, telefono, direccion),
          pagos!left(type, status, total_pago),
          ordenes_platos!left(
            platos!inner(id, name, pricing)
          ),
          ordenes_bebidas!left(
            bebidas!inner(id, name, pricing)
          )
        `)
        .eq('sede_id', sedeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error obteniendo pedidos de sede:', error);
        throw error;
      }

      const sedeOrders: SedeOrder[] = (data || []).map(order => {
        // Contar elementos agrupados por producto para obtener cantidades
        const platosMap = new Map();
        const bebidasMap = new Map();
        
        // Procesar platos
        (order.ordenes_platos || []).forEach((item: any) => {
          const platoId = item.platos.id;
          const existing = platosMap.get(platoId);
          if (existing) {
            existing.cantidad += 1;
          } else {
            platosMap.set(platoId, {
              id: platoId,
              producto_tipo: 'plato' as const,
              producto_id: platoId,
              producto_nombre: item.platos.name,
              cantidad: 1,
              precio_unitario: item.platos.pricing,
              precio_total: item.platos.pricing
            });
          }
        });
        
        // Procesar bebidas
        (order.ordenes_bebidas || []).forEach((item: any) => {
          const bebidaId = item.bebidas.id;
          const existing = bebidasMap.get(bebidaId);
          if (existing) {
            existing.cantidad += 1;
          } else {
            bebidasMap.set(bebidaId, {
              id: bebidaId,
              producto_tipo: 'bebida' as const,
              producto_id: bebidaId,
              producto_nombre: item.bebidas.name,
              cantidad: 1,
              precio_unitario: item.bebidas.pricing,
              precio_total: item.bebidas.pricing
            });
          }
        });
        
        // Actualizar precios totales después de contar
        platosMap.forEach(item => {
          item.precio_total = item.precio_unitario * item.cantidad;
        });
        bebidasMap.forEach(item => {
          item.precio_total = item.precio_unitario * item.cantidad;
        });
        
        const items: OrderItem[] = [
          ...Array.from(platosMap.values()),
          ...Array.from(bebidasMap.values())
        ];

        return {
          id: order.id,
          cliente_nombre: order.clientes?.nombre || 'Cliente',
          cliente_telefono: order.clientes?.telefono || '',
          direccion: order.clientes?.direccion || '',
          total: order.pagos?.total_pago || 0,
          estado: order.status || 'Recibidos',
          pago_tipo: order.pagos?.type || 'efectivo',
          pago_estado: order.pagos?.status || 'pending',
          tipo_entrega: 'delivery', // Por defecto
          instrucciones: order.observaciones,
          created_at: order.created_at,
          updated_at: order.created_at, // Usar created_at ya que updated_at no existe
          sede_id: sedeId,
          items
        };
      });

      console.log('✅ Pedidos de sede obtenidos:', sedeOrders.length);
      return sedeOrders;

    } catch (error) {
      console.error('❌ Error en getSedeOrders:', error);
      throw error;
    }
  }

  // Crear nuevo pedido
  async createOrder(orderData: CreateOrderData): Promise<SedeOrder> {
    try {
      console.log('📝 SedeOrders: Creando nuevo pedido:', orderData);

      // Paso 1: Crear/obtener cliente
      let clienteId: number;
      
      // Buscar cliente existente
      console.log('🔍 Buscando cliente con teléfono:', orderData.cliente_telefono);
      
      const { data: existingCliente, error: clienteSearchError } = await supabase
        .from('clientes')
        .select('id')
        .eq('telefono', orderData.cliente_telefono)
        .maybeSingle(); // Cambiar a maybeSingle para evitar errores si no existe

      if (clienteSearchError && clienteSearchError.code !== 'PGRST116') {
        throw clienteSearchError;
      }

      if (existingCliente) {
        clienteId = existingCliente.id;
        console.log('✅ Cliente existente encontrado:', clienteId);
        
        // Si hay datos de actualización y son diferentes, actualizar el cliente
        if (orderData.update_customer_data) {
          const updateData: any = {};
          
          // Solo actualizar campos que han cambiado
          if (orderData.update_customer_data.nombre !== orderData.cliente_nombre) {
            updateData.nombre = orderData.update_customer_data.nombre;
          }
          if (orderData.update_customer_data.telefono !== orderData.cliente_telefono) {
            updateData.telefono = orderData.update_customer_data.telefono;
          }
          if (orderData.update_customer_data.direccion && orderData.tipo_entrega === 'delivery') {
            updateData.direccion = orderData.update_customer_data.direccion;
          }
          
          // Solo actualizar si hay cambios
          if (Object.keys(updateData).length > 0) {
            console.log('🔄 Actualizando datos del cliente:', updateData);
            const { error: updateError } = await supabase
              .from('clientes')
              .update(updateData)
              .eq('id', clienteId);
              
            if (updateError) {
              console.error('⚠️ Error actualizando cliente (continuando):', updateError);
              // No lanzar error, continuar con el pedido
            } else {
              console.log('✅ Cliente actualizado exitosamente');
            }
          }
        }
      } else {
        // Crear nuevo cliente
        const { data: newCliente, error: clienteCreateError } = await supabase
          .from('clientes')
          .insert({
            nombre: orderData.cliente_nombre,
            telefono: orderData.cliente_telefono,
            direccion: orderData.direccion
          })
          .select('id')
          .single();

        if (clienteCreateError) {
          throw clienteCreateError;
        }

        clienteId = newCliente.id;
        console.log('✅ Nuevo cliente creado:', clienteId);
      }

      // Paso 2: Calcular total
      const total = await this.calculateOrderTotal(orderData.items, orderData.tipo_entrega);

      // Paso 3: Crear pago
      const { data: pago, error: pagoError } = await supabase
        .from('pagos')
        .insert({
          type: orderData.pago_tipo,
          status: 'pending',
          total_pago: total
        })
        .select('id')
        .single();

      if (pagoError) {
        throw pagoError;
      }

      console.log('✅ Pago creado:', pago.id);

      // Paso 4: Crear orden
      const { data: orden, error: ordenError } = await supabase
        .from('ordenes')
        .insert({
          cliente_id: clienteId,
          payment_id: pago.id,
          status: 'Recibidos',
          sede_id: orderData.sede_id,
          observaciones: orderData.instrucciones,
          // TODO: Agregar campos adicionales como tipo_entrega, sede_recogida cuando estén disponibles
        })
        .select('id')
        .single();

      if (ordenError) {
        throw ordenError;
      }

      console.log('✅ Orden creada:', orden.id);

      // Paso 5: Agregar items a la orden
      await this.addItemsToOrder(orden.id, orderData.items);

      // Paso 6: Obtener la orden completa y retornarla
      const sedeOrders = await this.getSedeOrders(orderData.sede_id, 1);
      const newOrder = sedeOrders.find(o => o.id === orden.id);

      if (!newOrder) {
        throw new Error('No se pudo obtener la orden creada');
      }

      console.log('✅ Pedido creado exitosamente:', newOrder.id);
      return newOrder;

    } catch (error) {
      console.error('❌ Error creando pedido:', error);
      throw error;
    }
  }

  // Función auxiliar para calcular el total del pedido
  private async calculateOrderTotal(items: CreateOrderData['items'], tipoEntrega: 'delivery' | 'pickup'): Promise<number> {
    let total = 0;

    for (const item of items) {
      if (item.producto_tipo === 'plato') {
        const { data, error } = await supabase
          .from('platos')
          .select('pricing')
          .eq('id', item.producto_id)
          .single();

        if (!error && data) {
          total += data.pricing * item.cantidad;
        }
      } else {
        const { data, error } = await supabase
          .from('bebidas')
          .select('pricing')
          .eq('id', item.producto_id)
          .single();

        if (!error && data) {
          total += data.pricing * item.cantidad;
        }
      }
    }

    // Add delivery fee of 6000 for delivery orders
    if (tipoEntrega === 'delivery') {
      total += 6000;
      console.log('✅ Delivery fee of 6000 added to order total');
    }

    return total;
  }

  // Función auxiliar para agregar items a la orden
  private async addItemsToOrder(ordenId: number, items: CreateOrderData['items']): Promise<void> {
    for (const item of items) {
      // Insertar múltiples veces según la cantidad solicitada
      for (let i = 0; i < item.cantidad; i++) {
        if (item.producto_tipo === 'plato') {
          // Solo insertar orden_id y plato_id (según esquema real)
          const insertData = {
            orden_id: ordenId,
            plato_id: item.producto_id
          };

          console.log('🔍 Insertando plato:', insertData);
          
          const { error: insertError } = await supabase
            .from('ordenes_platos')
            .insert(insertData);

          if (insertError) {
            console.error('❌ Error insertando plato:', insertError);
            throw insertError;
          } else {
            console.log('✅ Plato insertado exitosamente');
          }

        } else {
          // Solo insertar orden_id y bebidas_id (según esquema real)
          const insertData = {
            orden_id: ordenId,
            bebidas_id: item.producto_id
          };

          console.log('🔍 Insertando bebida:', insertData);

          const { error: insertError } = await supabase
            .from('ordenes_bebidas')
            .insert(insertData);

          if (insertError) {
            console.error('❌ Error insertando bebida:', insertError);
            throw insertError;
          } else {
            console.log('✅ Bebida insertada exitosamente');
          }
        }
      }
    }
  }

  // Transferir pedido a otra sede
  async transferOrder(orderId: number, targetSedeId: string): Promise<void> {
    try {
      console.log('🔄 SedeOrders: Transfiriendo pedido', orderId, 'a sede', targetSedeId);

      const { error } = await supabase
        .from('ordenes')
        .update({ 
          sede_id: targetSedeId
          // No actualizar updated_at ya que no existe en la tabla
        })
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      console.log('✅ Pedido transferido exitosamente');
    } catch (error) {
      console.error('❌ Error transfiriendo pedido:', error);
      throw error;
    }
  }
}

export const sedeOrdersService = new SedeOrdersService();