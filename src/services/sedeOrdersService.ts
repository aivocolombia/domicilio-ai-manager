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
  producto_tipo: 'plato' | 'bebida' | 'topping';
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
  address: string; // Dirección específica para esta orden
  tipo_entrega: 'delivery' | 'pickup';
  sede_recogida?: string;
  pago_tipo: 'efectivo' | 'tarjeta' | 'nequi' | 'transferencia';
  // Multi-payment support
  hasMultiplePayments?: boolean;
  pago_tipo2?: 'efectivo' | 'tarjeta' | 'nequi' | 'transferencia';
  pago_monto1?: number;
  pago_monto2?: number;
  instrucciones?: string;
  cubiertos?: number;
  items: {
    producto_tipo: 'plato' | 'bebida' | 'topping';
    producto_id: number;
    cantidad: number;
  }[];
  sede_id: string;
  // Tiempo de entrega en minutos (opcional, por defecto 90)
  delivery_time_minutes?: number;
  // Valor del domicilio (opcional, por defecto 6000)
  delivery_cost?: number;
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
          clientes!cliente_id(nombre, telefono, direccion),
          pagos!payment_id(type, status, total_pago),
          ordenes_platos!left(
            platos!inner(id, name, pricing)
          ),
          ordenes_bebidas!left(
            bebidas!inner(id, name, pricing)
          ),
          ordenes_toppings!left(
            toppings!inner(id, name, pricing)
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
        const toppingsMap = new Map();
        
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
        
        // Procesar toppings
        (order.ordenes_toppings || []).forEach((item: any) => {
          const toppingId = item.toppings.id;
          const existing = toppingsMap.get(toppingId);
          if (existing) {
            existing.cantidad += 1;
          } else {
            toppingsMap.set(toppingId, {
              id: toppingId,
              producto_tipo: 'topping' as const,
              producto_id: toppingId,
              producto_nombre: item.toppings.name,
              cantidad: 1,
              precio_unitario: item.toppings.pricing,
              precio_total: item.toppings.pricing
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
        toppingsMap.forEach(item => {
          item.precio_total = item.precio_unitario * item.cantidad;
        });
        
        const items: OrderItem[] = [
          ...Array.from(platosMap.values()),
          ...Array.from(bebidasMap.values()),
          ...Array.from(toppingsMap.values())
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

  // Obtener pedidos del día actual de una sede específica
  async getTodaySedeOrders(sedeId: string): Promise<SedeOrder[]> {
    try {
      console.log('📊 SedeOrders: Obteniendo pedidos del día de sede:', sedeId);

      // Crear fechas del día actual en zona horaria de Colombia
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      console.log('📅 DEBUG: Filtrando pedidos desde:', startOfDay.toISOString(), 'hasta:', endOfDay.toISOString());

      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          status,
          created_at,
          observaciones,
          clientes!cliente_id(nombre, telefono, direccion),
          pagos!payment_id(type, status, total_pago),
          ordenes_platos!left(
            platos!inner(id, name, pricing)
          ),
          ordenes_bebidas!left(
            bebidas!inner(id, name, pricing)
          ),
          ordenes_toppings!left(
            toppings!inner(id, name, pricing)
          )
        `)
        .eq('sede_id', sedeId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      console.log('📊 DEBUG: Query result - data length:', data?.length, 'error:', error);

      if (error) {
        console.error('❌ Error obteniendo pedidos del día de sede:', error);
        throw error;
      }

      console.log('✅ Pedidos del día obtenidos:', data?.length || 0);
      return this.processOrdersData(data || [], sedeId);

    } catch (error) {
      console.error('❌ Error en getTodaySedeOrders:', error);
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
          clientes!cliente_id(nombre, telefono, direccion),
          pagos!payment_id(type, status, total_pago),
          ordenes_platos!left(
            platos!inner(id, name, pricing)
          ),
          ordenes_bebidas!left(
            bebidas!inner(id, name, pricing)
          ),
          ordenes_toppings!left(
            toppings!inner(id, name, pricing)
          )
        `)
        .eq('sede_id', sedeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error obteniendo pedidos de sede:', error);
        throw error;
      }

      return this.processOrdersData(data || [], sedeId);

    } catch (error) {
      console.error('❌ Error en getSedeOrders:', error);
      throw error;
    }
  }

  // Función auxiliar para procesar datos de órdenes
  private processOrdersData(data: any[], sedeId: string): SedeOrder[] {
    const sedeOrders: SedeOrder[] = data.map(order => {
        // Contar elementos agrupados por producto para obtener cantidades
        const platosMap = new Map();
        const bebidasMap = new Map();
        const toppingsMap = new Map();
        
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
        
        // Procesar toppings
        (order.ordenes_toppings || []).forEach((item: any) => {
          const toppingId = item.toppings.id;
          const existing = toppingsMap.get(toppingId);
          if (existing) {
            existing.cantidad += 1;
          } else {
            toppingsMap.set(toppingId, {
              id: toppingId,
              producto_tipo: 'topping' as const,
              producto_id: toppingId,
              producto_nombre: item.toppings.name,
              cantidad: 1,
              precio_unitario: item.toppings.pricing,
              precio_total: item.toppings.pricing
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
        toppingsMap.forEach(item => {
          item.precio_total = item.precio_unitario * item.cantidad;
        });
        
        const items: OrderItem[] = [
          ...Array.from(platosMap.values()),
          ...Array.from(bebidasMap.values()),
          ...Array.from(toppingsMap.values())
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

      console.log('✅ Pedidos procesados:', sedeOrders.length);
      return sedeOrders;
  }

  // Crear nuevo pedido
  async createOrder(orderData: CreateOrderData): Promise<SedeOrder> {
    try {
      console.log('📝 SedeOrders: Creando nuevo pedido:', orderData);
      console.log('🔍 DEBUG - Datos críticos del pedido:', {
        tipo_entrega: orderData.tipo_entrega,
        delivery_cost: orderData.delivery_cost,
        delivery_cost_type: typeof orderData.delivery_cost,
        delivery_cost_defined: orderData.delivery_cost !== undefined,
        delivery_cost_truthy: !!orderData.delivery_cost
      });

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
            direccion: orderData.address
          })
          .select('id')
          .single();

        if (clienteCreateError) {
          throw clienteCreateError;
        }

        clienteId = newCliente.id;
        console.log('✅ Nuevo cliente creado:', clienteId);
      }

      // Paso 2: Calcular total con precios de sede
      const total = await this.calculateOrderTotal(orderData.items, orderData.tipo_entrega, orderData.delivery_cost, orderData.sede_id);

      // Paso 3: Crear pago(s)
      let paymentId: number;
      let paymentId2: number | undefined;

      if (orderData.hasMultiplePayments) {
        // Crear dos pagos separados
        console.log('💳 Creando múltiples pagos:', {
          pago1: { tipo: orderData.pago_tipo, monto: orderData.pago_monto1 },
          pago2: { tipo: orderData.pago_tipo2, monto: orderData.pago_monto2 }
        });

        // Primer pago
        const { data: pago1, error: pagoError1 } = await supabase
          .from('pagos')
          .insert({
            type: orderData.pago_tipo,
            status: 'pending',
            total_pago: orderData.pago_monto1
          })
          .select('id')
          .single();

        if (pagoError1) {
          throw pagoError1;
        }
        paymentId = pago1.id;

        // Segundo pago
        const { data: pago2, error: pagoError2 } = await supabase
          .from('pagos')
          .insert({
            type: orderData.pago_tipo2!,
            status: 'pending',
            total_pago: orderData.pago_monto2
          })
          .select('id')
          .single();

        if (pagoError2) {
          throw pagoError2;
        }
        paymentId2 = pago2.id;

        console.log('✅ Múltiples pagos creados:', { paymentId, paymentId2 });
      } else {
        // Crear un solo pago
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
        paymentId = pago.id;
        console.log('✅ Pago creado:', paymentId);
      }

      // Paso 4: Crear orden con hora_entrega personalizable
      const now = new Date();
      const deliveryMinutes = orderData.delivery_time_minutes || 90; // Por defecto 90 minutos
      const horaEntrega = new Date(now.getTime() + deliveryMinutes * 60 * 1000); // Convertir minutos a milisegundos
      
      console.log(`⏰ Tiempo de entrega configurado: ${deliveryMinutes} minutos - Entrega programada: ${horaEntrega.toLocaleString('es-CO')}`);

      // Debug del precio de envío antes de guardar
      const precioEnvioAGuardar = orderData.tipo_entrega === 'delivery' && orderData.delivery_cost ? orderData.delivery_cost : null;
      console.log('💰 Precio de envío a guardar:', precioEnvioAGuardar, '(tipo_entrega:', orderData.tipo_entrega, ', delivery_cost:', orderData.delivery_cost, ')');

      const { data: orden, error: ordenError } = await supabase
        .from('ordenes')
        .insert({
          cliente_id: clienteId,
          payment_id: paymentId,
          payment_id_2: paymentId2, // Agregar segundo pago si existe
          status: 'Recibidos',
          sede_id: orderData.sede_id,
          observaciones: orderData.instrucciones,
          address: orderData.address, // Dirección específica de esta orden
          hora_entrega: horaEntrega.toISOString(),
          cubiertos: orderData.cubiertos,
          // Para pedidos de pickup, repartidor_id debe ser null (no necesitan repartidor)
          repartidor_id: orderData.tipo_entrega === 'pickup' ? null : undefined, // undefined permite auto-asignación para delivery
          // CRÍTICO: Guardar el precio de envío para el auto-complete
          precio_envio: orderData.tipo_entrega === 'delivery' && orderData.delivery_cost ? orderData.delivery_cost : null,
          // Campos nuevos para clasificación
          source: 'sede', // Siempre 'sede' cuando se crea desde la UI
          type_order: orderData.tipo_entrega // 'delivery' o 'pickup'
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
  private async calculateOrderTotal(items: CreateOrderData['items'], tipoEntrega: 'delivery' | 'pickup', deliveryCost?: number, sedeId?: string): Promise<number> {
    let total = 0;

    console.log('💰 Calculando total con precios de sede:', sedeId);

    for (const item of items) {
      let precioFinal = 0;

      if (item.producto_tipo === 'plato') {
        // Primero obtener precio base
        const { data: platoBase, error: platoError } = await supabase
          .from('platos')
          .select('pricing')
          .eq('id', item.producto_id)
          .single();

        if (platoError || !platoBase) {
          console.error('❌ Error obteniendo plato base:', platoError);
          continue;
        }

        let precioBase = platoBase.pricing;

        // Si hay sede, buscar precio de sede
        if (sedeId) {
          const { data: sedePlato } = await supabase
            .from('sede_platos')
            .select('price_override')
            .eq('sede_id', sedeId)
            .eq('plato_id', item.producto_id)
            .single();

          if (sedePlato?.price_override !== null && sedePlato?.price_override !== undefined) {
            precioFinal = sedePlato.price_override;
            console.log(`🍽️ Plato ${item.producto_id}: usando precio sede ${precioFinal} (base: ${precioBase})`);
          } else {
            precioFinal = precioBase;
            console.log(`🍽️ Plato ${item.producto_id}: usando precio base ${precioBase}`);
          }
        } else {
          precioFinal = precioBase;
        }

        total += precioFinal * item.cantidad;

      } else if (item.producto_tipo === 'bebida') {
        // Primero obtener precio base
        const { data: bebidaBase, error: bebidaError } = await supabase
          .from('bebidas')
          .select('pricing')
          .eq('id', item.producto_id)
          .single();

        if (bebidaError || !bebidaBase) {
          console.error('❌ Error obteniendo bebida base:', bebidaError);
          continue;
        }

        let precioBase = bebidaBase.pricing;

        // Si hay sede, buscar precio de sede
        if (sedeId) {
          const { data: sedeBebida } = await supabase
            .from('sede_bebidas')
            .select('price_override')
            .eq('sede_id', sedeId)
            .eq('bebida_id', item.producto_id)
            .single();

          if (sedeBebida?.price_override !== null && sedeBebida?.price_override !== undefined) {
            precioFinal = sedeBebida.price_override;
            console.log(`🥤 Bebida ${item.producto_id}: usando precio sede ${precioFinal} (base: ${precioBase})`);
          } else {
            precioFinal = precioBase;
            console.log(`🥤 Bebida ${item.producto_id}: usando precio base ${precioBase}`);
          }
        } else {
          precioFinal = precioBase;
        }

        total += precioFinal * item.cantidad;

      } else if (item.producto_tipo === 'topping') {
        // Primero obtener precio base
        const { data: toppingBase, error: toppingError } = await supabase
          .from('toppings')
          .select('pricing')
          .eq('id', item.producto_id)
          .single();

        if (toppingError || !toppingBase) {
          console.error('❌ Error obteniendo topping base:', toppingError);
          continue;
        }

        let precioBase = toppingBase.pricing;

        // Si hay sede, buscar precio de sede
        if (sedeId) {
          const { data: sedeTopping } = await supabase
            .from('sede_toppings')
            .select('price_override')
            .eq('sede_id', sedeId)
            .eq('topping_id', item.producto_id)
            .single();

          if (sedeTopping?.price_override !== null && sedeTopping?.price_override !== undefined) {
            precioFinal = sedeTopping.price_override;
            console.log(`⭐ Topping ${item.producto_id}: usando precio sede ${precioFinal} (base: ${precioBase})`);
          } else {
            precioFinal = precioBase;
            console.log(`⭐ Topping ${item.producto_id}: usando precio base ${precioBase}`);
          }
        } else {
          precioFinal = precioBase;
        }

        total += precioFinal * item.cantidad;
      }
    }

    // Add custom delivery fee or default 6000 for delivery orders
    if (tipoEntrega === 'delivery') {
      const finalDeliveryCost = deliveryCost !== undefined ? deliveryCost : 6000;
      total += finalDeliveryCost;
      console.log(`✅ Delivery fee of ${finalDeliveryCost} added to order total`);
    }

    console.log(`💰 Total calculado con precios de sede: ${total}`);
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

        } else if (item.producto_tipo === 'bebida') {
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
        } else if (item.producto_tipo === 'topping') {
          // Insertar orden_id y topping_id en ordenes_toppings
          const insertData = {
            orden_id: ordenId,
            topping_id: item.producto_id
          };

          console.log('🔍 Insertando topping:', insertData);

          const { error: insertError } = await supabase
            .from('ordenes_toppings')
            .insert(insertData);

          if (insertError) {
            if (insertError.code === 'PGRST200' && insertError.message.includes('ordenes_toppings')) {
              console.warn('⚠️ Tabla ordenes_toppings no existe - saltando inserción de topping');
              // No lanzar error, solo advertencia
            } else {
              console.error('❌ Error insertando topping:', insertError);
              throw insertError;
            }
          } else {
            console.log('✅ Topping insertado exitosamente');
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