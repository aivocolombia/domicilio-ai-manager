// Servicio para manejar clientes y facturación electrónica

// URL del backend - puede configurarse mediante variable de entorno
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1';

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  direccion?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClienteFacturacion {
  id: number;
  cliente_id: number;
  tipo_facturacion: 'persona_natural' | 'persona_juridica';
  identification_type: string;
  identification_number: string;
  dv?: string;
  nombre_razon_social: string;
  organization_type: number; // 1 = Persona jurídica, 2 = Persona natural
  regime_code: string;
  es_default: boolean;
  es_activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateOrderRequest {
  cliente_id: string;
  sede_id: string;
  facturacion_id: number;
  order_id?: number; // ID de la orden existente (opcional). Si se envía, NO se crea nueva orden, solo se crea factura y se actualiza esta orden
  platos?: Array<{ plato_id: number; cantidad: number }>;
  bebidas?: Array<{ bebida_id: number; cantidad: number }>;
  toppings?: Array<{ topping_id: number; cantidad: number }>;
  observaciones?: string;
  descuento_valor?: number;
  descuento_comentario?: string;
}

// Interfaz para guardar facturación en caché
export interface PendingFacturacion {
  cliente_id: string;
  sede_id: string;
  facturacion_id: number;
  cliente_nombre?: string;
  facturacion_nombre?: string;
  platos?: Array<{ plato_id: number; cantidad: number }>;
  bebidas?: Array<{ bebida_id: number; cantidad: number }>;
  toppings?: Array<{ topping_id: number; cantidad: number }>;
  observaciones?: string;
  descuento_valor?: number;
  descuento_comentario?: string;
}

export interface InvoiceResponse {
  id: string;
  number: number;
  date: string;
  status: string;
  cude?: string;
  xml?: string;
  pdf?: string;
}

export interface CreateOrderResponse {
  order_id: number;
  invoice: InvoiceResponse;
  totals: {
    subtotal: number;
    tax_total: number;
    discount: number;
    total: number;
    items_count: number;
  };
  message: string;
}

class ClienteService {
  /**
   * Obtener un cliente por ID
   */
  async getClienteById(id: number): Promise<Cliente> {
    try {
      // Intentar primero con el backend
      try {
        const response = await fetch(`${API_BASE_URL}/clientes/${id}`);
        
        // Verificar si la respuesta es JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
            throw new Error(error.message || `Error al obtener cliente: ${response.status}`);
          }
          
          return await response.json();
        } else {
          // Si no es JSON, usar Supabase directamente
          throw new Error('Backend no disponible, usando Supabase directamente');
        }
      } catch (fetchError) {
        // Si falla el fetch o no es JSON, usar Supabase directamente
        console.warn('Backend no disponible, usando Supabase directamente:', fetchError);
        
        const { supabase } = await import('@/lib/supabase');
        
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          throw new Error(`Error al obtener cliente: ${error.message}`);
        }
        
        if (!data) {
          throw new Error('Cliente no encontrado');
        }
        
        return data as Cliente;
      }
    } catch (error) {
      console.error('Error al obtener cliente:', error);
      throw error;
    }
  }

  /**
   * Buscar clientes por nombre o teléfono
   */
  async searchClientes(query: string): Promise<Cliente[]> {
    try {
      // Por ahora, usamos Supabase directamente para buscar clientes
      // Si el backend tiene un endpoint de búsqueda, usarlo aquí
      const { supabase } = await import('@/lib/supabase');
      
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .or(`nombre.ilike.%${query}%,telefono.ilike.%${query}%`)
        .limit(20);
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error al buscar clientes:', error);
      throw error;
    }
  }

  /**
   * Obtener registros de facturación de un cliente
   */
  async getFacturacionesByClienteId(clienteId: number): Promise<ClienteFacturacion[]> {
    try {
      // Intentar primero con el backend
      try {
        const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}/facturacion`);
        
        // Verificar si la respuesta es JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
            throw new Error(error.message || `Error al obtener facturaciones: ${response.status}`);
          }
          
          const data = await response.json();
          // Filtrar solo los registros activos
          return data.filter((f: ClienteFacturacion) => f.es_activo === true);
        } else {
          // Si no es JSON, probablemente es HTML (error 404 o servidor no disponible)
          throw new Error('Backend no disponible, usando Supabase directamente');
        }
      } catch (fetchError) {
        // Si falla el fetch o no es JSON, usar Supabase directamente
        console.warn('Backend no disponible, usando Supabase directamente:', fetchError);
        
        const { supabase } = await import('@/lib/supabase');
        
        const { data, error } = await supabase
          .from('clientes_facturacion')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('es_activo', true)
          .order('es_default', { ascending: false })
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error al obtener facturaciones de Supabase:', error);
          throw new Error(`Error al obtener facturaciones: ${error.message}`);
        }
        
        return (data || []) as ClienteFacturacion[];
      }
    } catch (error) {
      console.error('Error al obtener facturaciones:', error);
      throw error;
    }
  }

  /**
   * Crear factura electrónica para una orden existente
   */
  async createInvoiceForOrder(orderId: number, request: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      // Validar que haya al menos un item
      const totalItems = 
        (request.platos?.length || 0) +
        (request.bebidas?.length || 0) +
        (request.toppings?.length || 0);
      
      if (totalItems === 0) {
        throw new Error('Debe incluir al menos un plato, bebida o topping');
      }
      
      // Validar campos requeridos
      if (!request.cliente_id || !request.sede_id || !request.facturacion_id) {
        throw new Error('Faltan datos requeridos: cliente, sede o facturación');
      }
      
      // Agregar order_id al request
      const requestWithOrderId: CreateOrderRequest = {
        ...request,
        order_id: orderId
      };
      
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestWithOrderId)
      });
      
      // Verificar si la respuesta es JSON
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        // Si la respuesta no es OK, intentar parsear el error
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
          throw new Error(error.message || `Error al generar factura: ${response.status}`);
        } else {
          // Si no es JSON, leer el texto de la respuesta
          const text = await response.text();
          throw new Error(`Error ${response.status}: ${text.substring(0, 200) || 'El backend no está disponible'}`);
        }
      }
      
      // Si la respuesta es exitosa pero no es JSON, es un error
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`El backend devolvió una respuesta no válida: ${text.substring(0, 200)}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error al crear factura para orden:', error);
      throw error;
    }
  }

  /**
   * Crear orden con facturación electrónica (DEPRECATED: usar createInvoiceForOrder después de crear la orden)
   */
  async createOrderWithInvoice(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      // Validar que haya al menos un item
      const totalItems = 
        (request.platos?.length || 0) +
        (request.bebidas?.length || 0) +
        (request.toppings?.length || 0);
      
      if (totalItems === 0) {
        throw new Error('Debe incluir al menos un plato, bebida o topping');
      }
      
      // Validar campos requeridos
      if (!request.cliente_id || !request.sede_id || !request.facturacion_id) {
        throw new Error('Faltan datos requeridos: cliente, sede o facturación');
      }
      
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });
      
      // Verificar si la respuesta es JSON
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        // Si la respuesta no es OK, intentar parsear el error
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
          throw new Error(error.message || `Error al generar factura: ${response.status}`);
        } else {
          // Si no es JSON, leer el texto de la respuesta
          const text = await response.text();
          throw new Error(`Error ${response.status}: ${text.substring(0, 200) || 'El backend no está disponible'}`);
        }
      }
      
      // Si la respuesta es exitosa pero no es JSON, es un error
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`El backend devolvió una respuesta no válida: ${text.substring(0, 200)}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error al crear orden con factura:', error);
      throw error;
    }
  }
}

export const clienteService = new ClienteService();

// Utilidades para manejar facturación en caché
const FACTURACION_CACHE_KEY = 'pending_facturacion';

export const facturacionCache = {
  /**
   * Guardar facturación pendiente en localStorage
   */
  save(pending: PendingFacturacion): void {
    try {
      localStorage.setItem(FACTURACION_CACHE_KEY, JSON.stringify(pending));
    } catch (error) {
      console.error('Error al guardar facturación en caché:', error);
    }
  },

  /**
   * Obtener facturación pendiente de localStorage
   */
  get(): PendingFacturacion | null {
    try {
      const cached = localStorage.getItem(FACTURACION_CACHE_KEY);
      if (!cached) return null;
      return JSON.parse(cached) as PendingFacturacion;
    } catch (error) {
      console.error('Error al leer facturación de caché:', error);
      return null;
    }
  },

  /**
   * Limpiar facturación pendiente de localStorage
   */
  clear(): void {
    try {
      localStorage.removeItem(FACTURACION_CACHE_KEY);
    } catch (error) {
      console.error('Error al limpiar facturación de caché:', error);
    }
  },

  /**
   * Verificar si hay facturación pendiente
   */
  hasPending(): boolean {
    return this.get() !== null;
  }
};

