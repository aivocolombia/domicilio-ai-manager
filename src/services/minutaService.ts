import { supabase } from '@/lib/supabase';

export interface OrderItemPlato {
  plato_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
}

export interface OrderItemBebida {
  bebida_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
}

export interface OrderItemTopping {
  topping_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
}

export interface MinutaOrderDetails {
  id: number;
  id_display: string;
  minuta_id: string;
  tipo_pedido: 'delivery' | 'pickup' | 'dine_in';
  created_at: string;
  status: string;
  observaciones?: string;
  
  // Cliente
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion?: string;
  
  // Sede
  sede_nombre: string;
  sede_direccion: string;
  
  // Pago
  pago_tipo: string;
  pago_total: number;
  precio_envio: number;
  
  // Repartidor (solo para delivery)
  repartidor_nombre?: string;
  
  // Productos
  platos: OrderItemPlato[];
  bebidas: OrderItemBebida[];
  toppings: OrderItemTopping[];
}

export class MinutaService {
  
  // Función para cambiar automáticamente el estado de "Recibidos" a "Cocina" al imprimir
  async updateOrderStatusToCocina(orderId: number): Promise<boolean> {
    try {
      // Primero verificar el estado actual
      const { data: orderData, error: checkError } = await supabase
        .from('ordenes')
        .select('status')
        .eq('id', orderId)
        .single();
      
      if (checkError || !orderData) {
        console.error('Error verificando estado de orden:', checkError);
        return false;
      }
      
      // Solo cambiar si está en "Recibidos"
      if (orderData.status === 'Recibidos') {
        const { error: updateError } = await supabase
          .from('ordenes')
          .update({ 
            status: 'Cocina',
            cocina_at: new Date().toISOString()
          })
          .eq('id', orderId);
        
        if (updateError) {
          console.error('Error actualizando estado a Cocina:', updateError);
          return false;
        }
        
        console.log(`✅ Orden ${orderId} automáticamente cambiada de "Recibidos" a "Cocina" al imprimir minuta`);
        return true;
      }
      
      return false; // No necesitaba cambio
    } catch (error) {
      console.error('Error en updateOrderStatusToCocina:', error);
      return false;
    }
  }
  private groupProducts(products: { nombre: string; precio: number }[]): { nombre: string; cantidad: number; precio: number }[] {
    const grouped = products.reduce((acc, product) => {
      const existing = acc.find(item => item.nombre === product.nombre && item.precio === product.precio);
      if (existing) {
        existing.cantidad += 1;
      } else {
        acc.push({ nombre: product.nombre, cantidad: 1, precio: product.precio });
      }
      return acc;
    }, [] as { nombre: string; cantidad: number; precio: number }[]);
    
    return grouped;
  }

  async getOrderDetailsForMinuta(orderId: number): Promise<MinutaOrderDetails | null> {
    try {
      // Timeout de 10 segundos para evitar cuelgues
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout al cargar datos de minuta')), 10000);
      });

      // Usar Promise.all para hacer las 4 consultas en paralelo (más rápido)
      const queryPromise = Promise.all([
        // Consulta principal de la orden
        supabase
          .from('ordenes')
          .select(`
            id,
            status,
            created_at,
            observaciones,
            precio_envio,
            clientes!inner(nombre, telefono, direccion),
            pagos!left(type, total_pago),
            repartidores!left(nombre),
            minutas!left(daily_id),
            sedes!inner(name, address)
          `)
          .eq('id', orderId)
          .single(),
        
        // Consulta de platos en paralelo
        supabase
          .from('ordenes_platos')
          .select(`
            id,
            platos!inner(name, pricing)
          `)
          .eq('orden_id', orderId),
        
        // Consulta de bebidas en paralelo
        supabase
          .from('ordenes_bebidas')
          .select(`
            id,
            bebidas!inner(name, pricing)
          `)
          .eq('orden_id', orderId),
        
        // Consulta de toppings en paralelo
        supabase
          .from('ordenes_toppings')
          .select(`
            id,
            toppings!inner(name, pricing)
          `)
          .eq('orden_id', orderId)
      ]);

      const [orderResult, platosResult, bebidasResult, toppingsResult] = await Promise.race([
        queryPromise,
        timeoutPromise
      ]);

      const { data: orderData, error: orderError } = orderResult;
      const { data: platosData, error: platosError } = platosResult;
      const { data: bebidasData, error: bebidasError } = bebidasResult;
      const { data: toppingsData, error: toppingsError } = toppingsResult;

      if (orderError || !orderData) {
        console.error('Error obteniendo datos de la orden:', orderError);
        return null;
      }

      if (platosError) {
        console.error('Error obteniendo platos:', platosError);
      }

      if (bebidasError) {
        console.error('Error obteniendo bebidas:', bebidasError);
      }

      if (toppingsError) {
        console.error('Error obteniendo toppings:', toppingsError);
      }

      // Determinar tipo de pedido basado en si tiene precio de envío o repartidor asignado
      const tipoPedido: 'delivery' | 'pickup' | 'dine_in' = 
        (orderData.precio_envio && orderData.precio_envio > 0) || orderData.repartidores 
          ? 'delivery' 
          : 'pickup';

      const minutaDetails: MinutaOrderDetails = {
        id: orderData.id,
        id_display: `ORD-${orderData.id.toString().padStart(4, '0')}`,
        minuta_id: orderData.minutas && orderData.minutas.length > 0 
          ? orderData.minutas[0].daily_id.toString() 
          : '0',
        tipo_pedido: tipoPedido,
        created_at: orderData.created_at,
        status: orderData.status || 'Desconocido',
        observaciones: orderData.observaciones,
        
        cliente_nombre: orderData.clientes?.nombre || 'Sin nombre',
        cliente_telefono: orderData.clientes?.telefono || 'Sin teléfono',
        cliente_direccion: orderData.clientes?.direccion,
        
        sede_nombre: orderData.sedes?.name || 'Sede no definida',
        sede_direccion: orderData.sedes?.address || 'Dirección no definida',
        
        pago_tipo: orderData.pagos?.type || 'Sin especificar',
        pago_total: orderData.pagos?.total_pago || 0,
        precio_envio: orderData.precio_envio || 0,
        
        repartidor_nombre: orderData.repartidores?.nombre,
        
        platos: this.groupProducts(platosData?.map(item => ({
          nombre: item.platos?.name || 'Producto sin nombre',
          precio: item.platos?.pricing || 0
        })) || []).map(item => ({
          plato_nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          precio_total: item.precio * item.cantidad
        })),
        
        bebidas: this.groupProducts(bebidasData?.map(item => ({
          nombre: item.bebidas?.name || 'Bebida sin nombre',
          precio: item.bebidas?.pricing || 0
        })) || []).map(item => ({
          bebida_nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          precio_total: item.precio * item.cantidad
        })),
        
        toppings: this.groupProducts(toppingsData?.map(item => ({
          nombre: item.toppings?.name || 'Topping sin nombre',
          precio: item.toppings?.pricing || 0
        })) || []).map(item => ({
          topping_nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          precio_total: item.precio * item.cantidad
        }))
      };

      return minutaDetails;
    } catch (error) {
      console.error('Error en getOrderDetailsForMinuta:', error);
      return null;
    }
  }
}

export const minutaService = new MinutaService();