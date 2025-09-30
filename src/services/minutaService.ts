import { supabase } from '@/lib/supabase';
import { substitutionHistoryService } from './substitutionHistoryService';

export interface OrderItemPlato {
  plato_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  orden_item_id?: number; // ID único del item en ordenes_platos
  substitutions?: Array<{
    type: 'product_substitution' | 'topping_substitution';
    original_name: string;
    substitute_name: string;
    price_difference: number;
    parent_item_name?: string;
  }>;
}

export interface OrderItemBebida {
  bebida_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  orden_item_id?: number; // ID único del item en ordenes_bebidas
  substitutions?: Array<{
    type: 'product_substitution' | 'topping_substitution';
    original_name: string;
    substitute_name: string;
    price_difference: number;
    parent_item_name?: string;
  }>;
}

export interface OrderItemTopping {
  topping_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  orden_item_id?: number; // ID único del item en ordenes_toppings
  substitutions?: Array<{
    type: 'product_substitution' | 'topping_substitution';
    original_name: string;
    substitute_name: string;
    price_difference: number;
    parent_item_name?: string;
  }>;
}

export interface MinutaOrderDetails {
  id: number;
  id_display: string;
  minuta_id: string;
  tipo_pedido: 'delivery' | 'pickup' | 'dine_in';
  created_at: string;
  status: string;
  observaciones?: string;
  cubiertos?: number;
  
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

  // Multi-payment support
  has_multiple_payments?: boolean;
  pago_tipo2?: string;
  pago_monto1?: number;
  pago_monto2?: number;
  
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
  /**
   * Agregar información de sustituciones a los productos
   */
  private async addSubstitutionsToProducts(
    products: any[],
    orderId: number,
    productType: 'plato' | 'bebida' | 'topping'
  ): Promise<any[]> {
    try {
      console.log(`🔍 MinutaService: Cargando sustituciones para orden ${orderId}, tipo: ${productType}`);

      // Obtener historial de sustituciones para esta orden
      const substitutionHistory = await substitutionHistoryService.getOrderSubstitutionHistory(orderId);

      console.log(`📋 MinutaService: Encontradas ${substitutionHistory.length} sustituciones:`, substitutionHistory);

      return products.map(product => {
        const productName = product.plato_nombre || product.bebida_nombre || product.topping_nombre;

        // Filtrar sustituciones relevantes usando la misma lógica que funciona en OrderDetailsModal
        const relevantSubstitutions = substitutionHistory.filter(sub => {
          console.log(`🔍 MinutaService: Evaluando substitución para producto "${productName}" (orden_item_id: ${product.orden_item_id}):`, {
            sub_orden_item_id: sub.orden_item_id,
            sub_type: sub.substitution_type,
            sub_original: sub.original_name,
            sub_substitute: sub.substitute_name,
            sub_parent: sub.parent_item_name
          });

          // NUEVO: Filtrar por orden_item_id específico si está disponible (igual que OrderDetailsModal)
          if (sub.orden_item_id && product.orden_item_id) {
            const match = sub.orden_item_id === product.orden_item_id;
            console.log(`🎯 MinutaService: Item ID match: ${match} (${sub.orden_item_id} === ${product.orden_item_id})`);
            return match;
          }

          console.log(`⚠️ MinutaService: Usando fallback - sub.orden_item_id: ${sub.orden_item_id}, product.orden_item_id: ${product.orden_item_id}`);
          // FALLBACK: Usar lógica anterior para compatibilidad
          return sub.substitution_type === 'product_substitution' ||
                 (sub.substitution_type === 'topping_substitution' && sub.parent_item_name === productName);
        });

        const productWithSubstitutions = {
          ...product,
          substitutions: relevantSubstitutions.length > 0 ? relevantSubstitutions.map(sub => ({
            type: sub.substitution_type,
            original_name: sub.original_name,
            substitute_name: sub.substitute_name,
            price_difference: sub.price_difference,
            parent_item_name: sub.parent_item_name
          })) : undefined
        };

        if (relevantSubstitutions.length > 0) {
          console.log(`✅ MinutaService: Producto ${productName} tiene ${relevantSubstitutions.length} sustituciones`);
        }

        return productWithSubstitutions;
      });
    } catch (error) {
      console.error('Error agregando sustituciones a productos:', error);
      // En caso de error, devolver productos sin sustituciones
      return products;
    }
  }

  // NOTA: groupProducts ya no se usa - ahora mantenemos items individuales con IDs únicos
  // private groupProducts() - REMOVIDO

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
            cubiertos,
            precio_envio,
            address,
            payment_id_2,
            clientes!cliente_id(nombre, telefono),
            pagos!payment_id(type, total_pago),
            pagos2:pagos!payment_id_2(type, total_pago),
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
        cubiertos: typeof orderData.cubiertos === 'number' ? orderData.cubiertos : (orderData.cubiertos ? Number(orderData.cubiertos) : 0),
        
        cliente_nombre: orderData.clientes?.nombre || 'Sin nombre',
        cliente_telefono: orderData.clientes?.telefono || 'Sin teléfono',
        cliente_direccion: orderData.address || 'Sin dirección',
        
        sede_nombre: orderData.sedes?.name || 'Sede no definida',
        sede_direccion: orderData.sedes?.address || 'Dirección no definida',
        
        pago_tipo: orderData.pagos?.type || 'Sin especificar',
        pago_total: !!orderData.payment_id_2
          ? (orderData.pagos?.total_pago || 0) + (orderData.pagos2?.total_pago || 0)
          : (orderData.pagos?.total_pago || 0),
        precio_envio: orderData.precio_envio || 0,

        // Multi-payment support
        has_multiple_payments: !!orderData.payment_id_2,
        pago_tipo2: orderData.pagos2?.type,
        pago_monto1: orderData.pagos?.total_pago,
        pago_monto2: orderData.pagos2?.total_pago,

        repartidor_nombre: orderData.repartidores?.nombre,

        platos: [],
        bebidas: [],
        toppings: []
      };

      // COPIADO EXACTAMENTE DE OrderDetailsModal que funciona
      const mappedPlatos = (platosData || []).map(item => ({
        plato_nombre: item.platos?.name || 'Producto sin nombre',
        cantidad: 1, // Cada item individual
        precio_unitario: item.platos?.pricing || 0,
        precio_total: item.platos?.pricing || 0,
        orden_item_id: item.id // ID único del item en ordenes_platos
      }));

      console.log('🔍 DEBUG MinutaService: Mapped platos with orden_item_id:', mappedPlatos);

      // Obtener historial de sustituciones para esta orden (igual que OrderDetailsModal)
      const substitutionHistory = await substitutionHistoryService.getOrderSubstitutionHistory(orderData.id);
      console.log(`📋 MinutaService: Historial de sustituciones:`, substitutionHistory);

      // Aplicar sustituciones usando la MISMA lógica que OrderDetailsModal
      minutaDetails.platos = mappedPlatos.map(product => ({
        ...product,
        substitutions: substitutionHistory
          .filter(sub => {
            console.log(`🔍 MinutaService: Evaluando substitución para producto "${product.plato_nombre}" (orden_item_id: ${product.orden_item_id}):`, {
              sub_orden_item_id: sub.orden_item_id,
              sub_type: sub.substitution_type,
              sub_original: sub.original_name,
              sub_substitute: sub.substitute_name,
              sub_parent: sub.parent_item_name
            });

            // COPIADO EXACTAMENTE: Filtrar por orden_item_id específico si está disponible
            if (sub.orden_item_id && product.orden_item_id) {
              const match = sub.orden_item_id === product.orden_item_id;
              console.log(`🎯 MinutaService: Item ID match: ${match} (${sub.orden_item_id} === ${product.orden_item_id})`);
              return match;
            }

            console.log(`⚠️ MinutaService: Usando fallback - sub.orden_item_id: ${sub.orden_item_id}, product.orden_item_id: ${product.orden_item_id}`);
            // FALLBACK: Usar lógica anterior para compatibilidad
            return sub.substitution_type === 'product_substitution' ||
                   (sub.substitution_type === 'topping_substitution' && sub.parent_item_name === product.plato_nombre);
          })
          .map(sub => ({
            type: sub.substitution_type,
            original_name: sub.original_name,
            substitute_name: sub.substitute_name,
            price_difference: sub.price_difference,
            parent_item_name: sub.parent_item_name
          }))
      }));

      minutaDetails.bebidas = await this.addSubstitutionsToProducts(
        bebidasData?.map(item => ({
          bebida_nombre: item.bebidas?.name || 'Bebida sin nombre',
          cantidad: 1, // Cada item individual
          precio_unitario: item.bebidas?.pricing || 0,
          precio_total: item.bebidas?.pricing || 0,
          orden_item_id: item.id // Mantener ID único del item en la orden
        })) || [],
        orderData.id,
        'bebida'
      );

      minutaDetails.toppings = await this.addSubstitutionsToProducts(
        toppingsData?.map(item => ({
          topping_nombre: item.toppings?.name || 'Topping sin nombre',
          cantidad: 1, // Cada item individual
          precio_unitario: item.toppings?.pricing || 0,
          precio_total: item.toppings?.pricing || 0,
          orden_item_id: item.id // Mantener ID único del item en la orden
        })) || [],
        orderData.id,
        'topping'
      );

      return minutaDetails;
    } catch (error) {
      console.error('Error en getOrderDetailsForMinuta:', error);
      return null;
    }
  }
}

export const minutaService = new MinutaService();