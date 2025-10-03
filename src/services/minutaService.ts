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

  /**
   * Agregar precios específicos por sede a los platos
   */
  private async addSedePricesToPlatos(platosData: any[], sedeId: string): Promise<OrderItemPlato[]> {
    try {
      console.log(`🍽️ MinutaService: Obteniendo precios por sede para ${platosData.length} platos en sede ${sedeId}`);

      if (!platosData || platosData.length === 0) {
        return [];
      }

      // Obtener los IDs de los platos únicos desde el campo plato_id
      const platoIds = [...new Set(platosData.map(item => item.plato_id).filter(id => id))];

      if (platoIds.length === 0) {
        console.warn('⚠️ MinutaService: No se encontraron IDs de platos válidos');
        return platosData.map(item => ({
          plato_nombre: item.platos?.name || 'Plato sin nombre',
          cantidad: 1,
          precio_unitario: item.platos?.pricing || 0,
          precio_total: item.platos?.pricing || 0,
          orden_item_id: item.id
        }));
      }

      // Consultar precios específicos por sede
      const { data: sedePlatos, error } = await supabase
        .from('sede_platos')
        .select('plato_id, price_override')
        .eq('sede_id', sedeId)
        .in('plato_id', platoIds);

      if (error) {
        console.error('❌ MinutaService: Error obteniendo precios de sede_platos:', error);
        // Fallback a precios base si hay error
        return platosData.map(item => ({
          plato_nombre: item.platos?.name || 'Plato sin nombre',
          cantidad: 1,
          precio_unitario: item.platos?.pricing || 0,
          precio_total: item.platos?.pricing || 0,
          orden_item_id: item.id
        }));
      }

      // Crear mapa de precios por sede
      const sedePricesMap = new Map();
      sedePlatos?.forEach(sedePlato => {
        if (sedePlato.price_override !== null && sedePlato.price_override !== undefined) {
          sedePricesMap.set(sedePlato.plato_id, sedePlato.price_override);
        }
      });

      console.log(`💰 MinutaService: Precios por sede encontrados para platos:`, Object.fromEntries(sedePricesMap));

      // Mapear platos con precios correctos usando plato_id
      const result = platosData.map(item => {
        const platoId = item.plato_id;
        const precioBase = item.platos?.pricing || 0;
        const precioSede = sedePricesMap.get(platoId);
        const precioFinal = precioSede !== undefined ? precioSede : precioBase;

        console.log(`🍽️ MinutaService: Plato ${item.platos?.name} (ID: ${platoId}):`, {
          precioBase,
          precioSede,
          precioFinal,
          tieneOverride: precioSede !== undefined
        });

        return {
          plato_nombre: item.platos?.name || 'Plato sin nombre',
          cantidad: 1,
          precio_unitario: precioFinal,
          precio_total: precioFinal,
          orden_item_id: item.id
        };
      });

      console.log(`✅ MinutaService: ${result.length} platos procesados con precios por sede`);
      return result;
    } catch (error) {
      console.error('❌ MinutaService: Error en addSedePricesToPlatos:', error);
      // Fallback a precios base en caso de error
      return platosData.map(item => ({
        plato_nombre: item.platos?.name || 'Plato sin nombre',
        cantidad: 1,
        precio_unitario: item.platos?.pricing || 0,
        precio_total: item.platos?.pricing || 0,
        orden_item_id: item.id
      }));
    }
  }

  /**
   * Agregar precios específicos por sede a las bebidas
   */
  private async addSedePricesToBebidas(bebidasData: any[], sedeId: string): Promise<OrderItemBebida[]> {
    try {
      console.log(`🥤 MinutaService: Obteniendo precios por sede para ${bebidasData.length} bebidas en sede ${sedeId}`);

      if (!bebidasData || bebidasData.length === 0) {
        return [];
      }

      // Obtener los IDs de las bebidas únicas desde el campo bebidas_id
      const bebidaIds = [...new Set(bebidasData.map(item => item.bebidas_id).filter(id => id))];

      if (bebidaIds.length === 0) {
        console.warn('⚠️ MinutaService: No se encontraron IDs de bebidas válidos');
        return bebidasData.map(item => ({
          bebida_nombre: item.bebidas?.name || 'Bebida sin nombre',
          cantidad: 1,
          precio_unitario: item.bebidas?.pricing || 0,
          precio_total: item.bebidas?.pricing || 0,
          orden_item_id: item.id
        }));
      }

      // Consultar precios específicos por sede
      const { data: sedeBebidas, error } = await supabase
        .from('sede_bebidas')
        .select('bebida_id, price_override')
        .eq('sede_id', sedeId)
        .in('bebida_id', bebidaIds);

      if (error) {
        console.error('❌ MinutaService: Error obteniendo precios de sede_bebidas:', error);
        // Fallback a precios base si hay error
        return bebidasData.map(item => ({
          bebida_nombre: item.bebidas?.name || 'Bebida sin nombre',
          cantidad: 1,
          precio_unitario: item.bebidas?.pricing || 0,
          precio_total: item.bebidas?.pricing || 0,
          orden_item_id: item.id
        }));
      }

      // Crear mapa de precios por sede
      const sedePricesMap = new Map();
      sedeBebidas?.forEach(sedeBebida => {
        if (sedeBebida.price_override !== null && sedeBebida.price_override !== undefined) {
          sedePricesMap.set(sedeBebida.bebida_id, sedeBebida.price_override);
        }
      });

      console.log(`💰 MinutaService: Precios por sede encontrados:`, Object.fromEntries(sedePricesMap));

      // Mapear bebidas con precios correctos usando bebidas_id
      const result = bebidasData.map(item => {
        const bebidaId = item.bebidas_id;
        const precioBase = item.bebidas?.pricing || 0;
        const precioSede = sedePricesMap.get(bebidaId);
        const precioFinal = precioSede !== undefined ? precioSede : precioBase;

        console.log(`🥤 MinutaService: Bebida ${item.bebidas?.name} (ID: ${bebidaId}):`, {
          precioBase,
          precioSede,
          precioFinal,
          tieneOverride: precioSede !== undefined
        });

        return {
          bebida_nombre: item.bebidas?.name || 'Bebida sin nombre',
          cantidad: 1,
          precio_unitario: precioFinal,
          precio_total: precioFinal,
          orden_item_id: item.id
        };
      });

      console.log(`✅ MinutaService: ${result.length} bebidas procesadas con precios por sede`);
      return result;
    } catch (error) {
      console.error('❌ MinutaService: Error en addSedePricesToBebidas:', error);
      // Fallback a precios base en caso de error
      return bebidasData.map(item => ({
        bebida_nombre: item.bebidas?.name || 'Bebida sin nombre',
        cantidad: 1,
        precio_unitario: item.bebidas?.pricing || 0,
        precio_total: item.bebidas?.pricing || 0,
        orden_item_id: item.id
      }));
    }
  }

  /**
   * Agregar precios específicos por sede a los toppings
   */
  private async addSedePricesToToppings(toppingsData: any[], sedeId: string): Promise<OrderItemTopping[]> {
    try {
      console.log(`⭐ MinutaService: Obteniendo precios por sede para ${toppingsData.length} toppings en sede ${sedeId}`);

      if (!toppingsData || toppingsData.length === 0) {
        return [];
      }

      // Obtener los IDs de los toppings únicos desde el campo topping_id
      const toppingIds = [...new Set(toppingsData.map(item => item.topping_id).filter(id => id))];

      if (toppingIds.length === 0) {
        console.warn('⚠️ MinutaService: No se encontraron IDs de toppings válidos');
        return toppingsData.map(item => ({
          topping_nombre: item.toppings?.name || 'Topping sin nombre',
          cantidad: 1,
          precio_unitario: item.toppings?.pricing || 0,
          precio_total: item.toppings?.pricing || 0,
          orden_item_id: item.id
        }));
      }

      // Consultar precios específicos por sede
      const { data: sedeToppings, error } = await supabase
        .from('sede_toppings')
        .select('topping_id, price_override')
        .eq('sede_id', sedeId)
        .in('topping_id', toppingIds);

      if (error) {
        console.error('❌ MinutaService: Error obteniendo precios de sede_toppings:', error);
        // Fallback a precios base si hay error
        return toppingsData.map(item => ({
          topping_nombre: item.toppings?.name || 'Topping sin nombre',
          cantidad: 1,
          precio_unitario: item.toppings?.pricing || 0,
          precio_total: item.toppings?.pricing || 0,
          orden_item_id: item.id
        }));
      }

      // Crear mapa de precios por sede
      const sedePricesMap = new Map();
      sedeToppings?.forEach(sedeTopping => {
        if (sedeTopping.price_override !== null && sedeTopping.price_override !== undefined) {
          sedePricesMap.set(sedeTopping.topping_id, sedeTopping.price_override);
        }
      });

      console.log(`💰 MinutaService: Precios por sede encontrados para toppings:`, Object.fromEntries(sedePricesMap));

      // Mapear toppings con precios correctos usando topping_id
      const result = toppingsData.map(item => {
        const toppingId = item.topping_id;
        const precioBase = item.toppings?.pricing || 0;
        const precioSede = sedePricesMap.get(toppingId);
        const precioFinal = precioSede !== undefined ? precioSede : precioBase;

        console.log(`⭐ MinutaService: Topping ${item.toppings?.name} (ID: ${toppingId}):`, {
          precioBase,
          precioSede,
          precioFinal,
          tieneOverride: precioSede !== undefined
        });

        return {
          topping_nombre: item.toppings?.name || 'Topping sin nombre',
          cantidad: 1,
          precio_unitario: precioFinal,
          precio_total: precioFinal,
          orden_item_id: item.id
        };
      });

      console.log(`✅ MinutaService: ${result.length} toppings procesados con precios por sede`);
      return result;
    } catch (error) {
      console.error('❌ MinutaService: Error en addSedePricesToToppings:', error);
      // Fallback a precios base en caso de error
      return toppingsData.map(item => ({
        topping_nombre: item.toppings?.name || 'Topping sin nombre',
        cantidad: 1,
        precio_unitario: item.toppings?.pricing || 0,
        precio_total: item.toppings?.pricing || 0,
        orden_item_id: item.id
      }));
    }
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
            cubiertos,
            precio_envio,
            address,
            payment_id_2,
            sede_id,
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
            plato_id,
            platos!inner(id, name, pricing)
          `)
          .eq('orden_id', orderId),

        // Consulta de bebidas en paralelo
        supabase
          .from('ordenes_bebidas')
          .select(`
            id,
            bebidas_id,
            bebidas!inner(id, name, pricing)
          `)
          .eq('orden_id', orderId),

        // Consulta de toppings en paralelo
        supabase
          .from('ordenes_toppings')
          .select(`
            id,
            topping_id,
            toppings!inner(id, name, pricing)
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

      // Obtener precios específicos por sede para platos
      const platosWithSedePrice = await this.addSedePricesToPlatos(platosData || [], orderData.sede_id);

      console.log('🔍 DEBUG MinutaService: Platos con precios por sede:', platosWithSedePrice);

      // Obtener historial de sustituciones para esta orden (igual que OrderDetailsModal)
      const substitutionHistory = await substitutionHistoryService.getOrderSubstitutionHistory(orderData.id);
      console.log(`📋 MinutaService: Historial de sustituciones:`, substitutionHistory);

      // Aplicar sustituciones usando la MISMA lógica que OrderDetailsModal
      minutaDetails.platos = platosWithSedePrice.map(product => ({
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

      // Obtener precios específicos por sede para bebidas
      const bebidasWithSedePrice = await this.addSedePricesToBebidas(bebidasData || [], orderData.sede_id);

      minutaDetails.bebidas = await this.addSubstitutionsToProducts(
        bebidasWithSedePrice,
        orderData.id,
        'bebida'
      );

      // Obtener precios específicos por sede para toppings
      const toppingsWithSedePrice = await this.addSedePricesToToppings(toppingsData || [], orderData.sede_id);

      minutaDetails.toppings = await this.addSubstitutionsToProducts(
        toppingsWithSedePrice,
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