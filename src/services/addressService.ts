import { supabase } from '@/lib/supabase';
import { logDebug, logError } from '@/utils/logger';

export interface AddressHistory {
  address: string;
  precio_envio: number;
  created_at: string;
}

export const addressService = {
  /**
   * Normaliza una dirección para búsqueda eficaz
   */
  normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9\s#\-]/g, '') // Mantener solo letras, números, espacios, # y -
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Busca el último precio de envío usado para una dirección específica
   */
  async getLastDeliveryPriceForAddress(address: string, sedeId: string): Promise<number | null> {
    if (!address.trim() || !sedeId) {
      console.log('❌ AddressService: Dirección o sede vacía', { address, sedeId });
      return null;
    }

    try {
      console.log('🔍 AddressService: Buscando último precio para dirección', { address, sedeId });

      // Normalizar dirección para búsqueda más eficaz
      const normalizedAddress = this.normalizeAddress(address);
      console.log('🔍 AddressService: Dirección normalizada', { normalizedAddress });

      // También intentar con palabras clave individuales para búsqueda más flexible
      const addressWords = normalizedAddress.split(/\s+/).filter(word => word.length > 2);
      console.log('🔍 AddressService: Palabras clave extraídas', { addressWords });

      // Primero, vamos a buscar sin el join para ver qué hay - TODAS las órdenes recientes
      const { data: testData, error: testError } = await supabase
        .from('ordenes')
        .select('id, precio_envio, created_at, cliente_id, sede_id')
        .eq('sede_id', sedeId)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('🔍 AddressService: TODAS las órdenes recientes en esta sede:');
      console.table(testData?.map(order => ({
        ID: order.id,
        precio_envio: order.precio_envio,
        fecha: new Date(order.created_at).toLocaleString('es-CO'),
        cliente_id: order.cliente_id
      })));

      // Ahora solo las que tienen precio de envío > 0
      const { data: ordersWithPrice, error: priceError } = await supabase
        .from('ordenes')
        .select('id, precio_envio, created_at, cliente_id, sede_id')
        .eq('sede_id', sedeId)
        .not('precio_envio', 'is', null)
        .gt('precio_envio', 0)
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('🔍 AddressService: Órdenes con precio_envio > 0:', { ordersWithPrice, priceError });

      // Debug: Vamos a ver qué direcciones existen para esta sede
      const { data: allAddresses, error: allError } = await supabase
        .from('ordenes')
        .select(`
          id,
          precio_envio,
          created_at,
          address
        `)
        .eq('sede_id', sedeId)
        .not('precio_envio', 'is', null)
        .gt('precio_envio', 0)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('🔍 AddressService: Direcciones existentes en esta sede:', { 
        sedeId, 
        addresses: allAddresses?.map(order => ({
          id: order.id,
          direccion: order.address,
          precio: order.precio_envio,
          fecha: order.created_at
        })),
        error: allError
      });

      // DEBUG: Si tenemos órdenes con precio pero el JOIN no funciona, investigar
      if (ordersWithPrice && ordersWithPrice.length > 0 && (!allAddresses || allAddresses.length === 0)) {
        console.log('🚨 AddressService: PROBLEMA DETECTADO - Hay órdenes con precio pero el JOIN con clientes falla');
        
        // Verificar datos de clientes para las órdenes con precio
        for (const order of ordersWithPrice) {
          const { data: clienteData, error: clienteError } = await supabase
            .from('clientes')
            .select('id, nombre, telefono, direccion')
            .eq('id', order.cliente_id)
            .single();
          
          console.log(`🔍 Cliente para orden ${order.id}:`, { 
            clienteData, 
            clienteError,
            order_precio: order.precio_envio,
            order_fecha: order.created_at
          });
        }
      } else if (!allAddresses || allAddresses.length === 0) {
        console.log('💡 AddressService: Esta sede no tiene historial de domicilios. El auto-complete funcionará después de crear la primera orden con domicilio en esta sede.');
      }

      // NUEVA LÓGICA: Buscar primero clientes por dirección, luego sus órdenes
      console.log('🔍 AddressService: Buscando clientes por dirección...');
      
      // Paso 1: Buscar clientes que tengan direcciones similares
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, direccion')
        .ilike('direccion', `%${normalizedAddress}%`)
        .limit(10);

      console.log('🔍 AddressService: Clientes encontrados con dirección similar:', { 
        clientes: clientes?.map(c => ({ id: c.id, direccion: c.direccion })),
        error: clientesError,
        searchTerm: normalizedAddress
      });

      if (clientesError) {
        console.error('❌ AddressService: Error buscando clientes', clientesError);
        throw clientesError;
      }

      let data = null;
      let error = null;

      // Paso 2: Si encontramos clientes, buscar sus órdenes más recientes en esta sede
      if (clientes && clientes.length > 0) {
        const clienteIds = clientes.map(c => c.id);
        
        const { data: ordenes, error: ordenesError } = await supabase
          .from('ordenes')
          .select('precio_envio, created_at, cliente_id')
          .eq('sede_id', sedeId)
          .in('cliente_id', clienteIds)
          .not('precio_envio', 'is', null)
          .gt('precio_envio', 0)
          .order('created_at', { ascending: false })
          .limit(1);

        console.log('🔍 AddressService: Órdenes encontradas para estos clientes:', { 
          ordenes,
          error: ordenesError,
          clienteIds,
          sedeId
        });

        data = ordenes;
        error = ordenesError;
      } else {
        console.log('🔍 AddressService: No se encontraron clientes con dirección similar');
        data = [];
        error = null;
      }

      if (error) {
        console.error('❌ AddressService: Error buscando precio de envío', error);
        logError('AddressService', 'Error buscando precio de envío', error);
        return null;
      }

      if (data && data.length > 0) {
        const lastPrice = data[0].precio_envio;
        console.log('✅ AddressService: Precio encontrado con búsqueda exacta', { address, precio: lastPrice });
        logDebug('AddressService', 'Precio encontrado', { address, precio: lastPrice });
        return lastPrice;
      }

      // Si no se encontró con búsqueda exacta, intentar con palabras clave
      if (addressWords.length > 0) {
        console.log('🔍 AddressService: Intentando búsqueda por palabras clave...');
        
        for (const word of addressWords) {
          // Buscar clientes por palabra clave
          const { data: keywordClientes, error: keywordClientesError } = await supabase
            .from('clientes')
            .select('id, direccion')
            .ilike('direccion', `%${word}%`)
            .limit(5);

          console.log(`🔍 AddressService: Clientes por palabra "${word}":`, { keywordClientes, error: keywordClientesError });

          if (keywordClientes && keywordClientes.length > 0) {
            const keywordClienteIds = keywordClientes.map(c => c.id);
            
            const { data: keywordOrdenes, error: keywordOrdenesError } = await supabase
              .from('ordenes')
              .select('precio_envio, created_at, cliente_id')
              .eq('sede_id', sedeId)
              .in('cliente_id', keywordClienteIds)
              .not('precio_envio', 'is', null)
              .gt('precio_envio', 0)
              .order('created_at', { ascending: false })
              .limit(1);

            console.log(`🔍 AddressService: Órdenes por palabra "${word}":`, { keywordOrdenes, error: keywordOrdenesError });

            if (keywordOrdenes && keywordOrdenes.length > 0) {
              const lastPrice = keywordOrdenes[0].precio_envio;
              console.log('✅ AddressService: Precio encontrado con palabra clave', { word, address, precio: lastPrice });
              logDebug('AddressService', 'Precio encontrado con palabra clave', { word, address, precio: lastPrice });
              return lastPrice;
            }
          }
        }
      }

      // BUSCAR SOLO EN LA SEDE ACTUAL - NO usar fallback cross-sede 
      // Ya buscamos exhaustivamente en la sede actual arriba, así que no hay precio para esta dirección en esta sede
      console.log('🔍 AddressService: No se encontró precio en la sede actual, no usando fallback cross-sede');
      console.log('💡 AddressService: Para obtener precio, debe haber al menos una orden previa con domicilio en esta sede');

      console.log('⚠️ AddressService: No se encontró precio previo en ninguna sede', { address, normalizedAddress, addressWords });
      logDebug('AddressService', 'No se encontró precio previo', { address });
      return null;
    } catch (error) {
      console.error('❌ AddressService: Error en getLastDeliveryPriceForAddress', error);
      logError('AddressService', 'Error en getLastDeliveryPriceForAddress', error);
      return null;
    }
  },

  /**
   * Busca direcciones similares con sus últimos precios (para autocompletado avanzado)
   */
  async getSimilarAddresses(partialAddress: string, sedeId: string, limit: number = 5): Promise<AddressHistory[]> {
    if (!partialAddress.trim() || partialAddress.length < 3 || !sedeId) {
      return [];
    }

    try {
      logDebug('AddressService', 'Buscando direcciones similares', { partialAddress, sedeId, limit });

      const normalizedAddress = partialAddress.trim().toLowerCase();

      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          precio_envio,
          created_at,
          address
        `)
        .eq('sede_id', sedeId)
        .not('precio_envio', 'is', null)
        .gt('precio_envio', 0)
        .ilike('address', `%${normalizedAddress}%`)
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Buscar más para filtrar duplicados

      if (error) {
        logError('AddressService', 'Error buscando direcciones similares', error);
        return [];
      }

      // Filtrar direcciones únicas (tomar la más reciente de cada dirección)
      const uniqueAddresses: { [key: string]: AddressHistory } = {};
      
      data?.forEach(order => {
        const direccion = order.address;
        if (direccion && (!uniqueAddresses[direccion] ||
            new Date(order.created_at) > new Date(uniqueAddresses[direccion].created_at))) {
          uniqueAddresses[direccion] = {
            address: direccion,
            precio_envio: order.precio_envio,
            created_at: order.created_at
          };
        }
      });

      const result = Object.values(uniqueAddresses).slice(0, limit);
      logDebug('AddressService', 'Direcciones encontradas', { count: result.length });
      return result;
    } catch (error) {
      logError('AddressService', 'Error en getSimilarAddresses', error);
      return [];
    }
  }
};