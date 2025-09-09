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
  
  // Pago
  pago_tipo: string;
  pago_total: number;
  precio_envio: number;
  
  // Repartidor (solo para delivery)
  repartidor_nombre?: string;
  
  // Productos
  platos: OrderItemPlato[];
  bebidas: OrderItemBebida[];
}

export class MinutaService {
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
      // Obtener datos básicos de la orden con relaciones
      const { data: orderData, error: orderError } = await supabase
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
          minutas!left(daily_id)
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        console.error('Error obteniendo datos de la orden:', orderError);
        return null;
      }

      // Obtener platos de la orden
      const { data: platosData, error: platosError } = await supabase
        .from('ordenes_platos')
        .select(`
          id,
          platos!inner(name, pricing)
        `)
        .eq('orden_id', orderId);

      if (platosError) {
        console.error('Error obteniendo platos:', platosError);
      }

      // Obtener bebidas de la orden
      const { data: bebidasData, error: bebidasError } = await supabase
        .from('ordenes_bebidas')
        .select(`
          id,
          bebidas!inner(name, pricing)
        `)
        .eq('orden_id', orderId);

      if (bebidasError) {
        console.error('Error obteniendo bebidas:', bebidasError);
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