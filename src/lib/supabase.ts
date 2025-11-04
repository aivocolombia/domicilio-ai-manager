import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '@/config/api';

// Verificar configuraci�n antes de crear el cliente
if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
  console.error('ERROR: Variables de entorno de Supabase no configuradas');
  throw new Error('Variables de entorno de Supabase no configuradas');
}

// Crear cliente de Supabase con configuración personalizada
export const supabase = createClient(
  SUPABASE_CONFIG.URL,
  SUPABASE_CONFIG.ANON_KEY,
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        // Preferencia para obtener más de 1000 registros
        'Prefer': 'return=representation',
      },
    },
  }
);

// Tipos para las tablas de Supabase - Actualizados para coincidir con el esquema real
export interface Database {
  public: {
    Tables: {
      platos: {
        Row: {
          id: number; // bigint
          name: string | null;
          description: string | null;
          pricing: number | null; // integer
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          name?: string | null;
          description?: string | null;
          pricing?: number | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          description?: string | null;
          pricing?: number | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      bebidas: {
        Row: {
          id: number; // smallint
          name: string | null;
          pricing: number | null; // bigint
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          name?: string | null;
          pricing?: number | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          pricing?: number | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      toppings: {
        Row: {
          id: number; // integer
          name: string | null;
          pricing: number | null; // smallint
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          name?: string | null;
          pricing?: number | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          pricing?: number | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      plato_toppings: {
        Row: {
          id: number; // bigint
          plato_id: number | null; // bigint
          topping_id: number | null; // integer
          created_at: string;
        };
        Insert: {
          id?: number;
          plato_id?: number | null;
          topping_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          plato_id?: number | null;
          topping_id?: number | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string; // uuid
          nickname: string;
          display_name: string;
          password_hash: string;
          role: 'agent' | 'admin_punto' | 'admin_global';
          sede_id: string; // uuid - OBLIGATORIO
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          nickname: string;
          display_name: string;
          password_hash: string;
          role: 'agent' | 'admin_punto' | 'admin_global';
          sede_id: string; // uuid - OBLIGATORIO
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          nickname?: string;
          display_name?: string;
          password_hash?: string;
          role?: 'agent' | 'admin_punto' | 'admin_global';
          sede_id?: string; // uuid
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      sedes: {
        Row: {
          id: string; // uuid
          name: string;
          address: string;
          phone: string;
          is_active: boolean | null;
          current_capacity: number | null; // integer
          max_capacity: number; // integer
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          phone: string;
          is_active?: boolean | null;
          current_capacity?: number | null;
          max_capacity: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          phone?: string;
          is_active?: boolean | null;
          current_capacity?: number | null;
          max_capacity?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      sede_platos: {
        Row: {
          sede_id: string; // uuid
          plato_id: number; // bigint
          available: boolean | null;
          price_override: number | null; // integer
          updated_at: string | null;
        };
        Insert: {
          sede_id: string;
          plato_id: number;
          available?: boolean | null;
          price_override?: number | null;
          updated_at?: string | null;
        };
        Update: {
          sede_id?: string;
          plato_id?: number;
          available?: boolean | null;
          price_override?: number | null;
          updated_at?: string | null;
        };
      };
      sede_bebidas: {
        Row: {
          sede_id: string; // uuid
          bebida_id: number; // smallint
          available: boolean | null;
          price_override: number | null; // integer
          updated_at: string | null;
        };
        Insert: {
          sede_id: string;
          bebida_id: number;
          available?: boolean | null;
          price_override?: number | null;
          updated_at?: string | null;
        };
        Update: {
          sede_id?: string;
          bebida_id?: number;
          available?: boolean | null;
          price_override?: number | null;
          updated_at?: string | null;
        };
      };
      sede_toppings: {
        Row: {
          sede_id: string; // uuid
          topping_id: number; // integer
          available: boolean | null;
          price_override: number | null; // integer
          updated_at: string | null;
        };
        Insert: {
          sede_id: string;
          topping_id: number;
          available?: boolean | null;
          price_override?: number | null;
          updated_at?: string | null;
        };
        Update: {
          sede_id?: string;
          topping_id?: number;
          available?: boolean | null;
          price_override?: number | null;
          updated_at?: string | null;
        };
      };
      ordenes: {
        Row: {
          id: number; // bigint
          repartidor_id: number | null; // bigint
          date: string | null; // timestamp without time zone
          status: string | null;
          payment_id: number | null; // bigint - Pago principal
          payment_id_2: number | null; // bigint - Pago secundario
          time: number | null; // integer
          add_time: number | null; // integer
          razon_tiempo_extra: string | null;
          hora_entrega: string | null; // timestamp with time zone
          created_at: string;
          observaciones: string | null;
          cliente_id: number | null; // bigint
          sede_id: string | null; // uuid
          precio_envio: number | null; // integer
          address: string | null; // Dirección específica de esta orden
          motivo_cancelacion: string | null; // Motivo de cancelación
        };
        Insert: {
          id?: number;
          repartidor_id?: number | null;
          date?: string | null;
          status?: string | null;
          payment_id?: number | null;
          payment_id_2?: number | null;
          time?: number | null;
          add_time?: number | null;
          razon_tiempo_extra?: string | null;
          hora_entrega?: string | null;
          created_at?: string;
          observaciones?: string | null;
          cliente_id?: number | null;
          sede_id?: string | null;
          precio_envio?: number | null;
          address?: string | null;
          motivo_cancelacion?: string | null;
        };
        Update: {
          id?: number;
          repartidor_id?: number | null;
          date?: string | null;
          status?: string | null;
          payment_id?: number | null;
          payment_id_2?: number | null;
          time?: number | null;
          add_time?: number | null;
          razon_tiempo_extra?: string | null;
          hora_entrega?: string | null;
          created_at?: string;
          observaciones?: string | null;
          cliente_id?: number | null;
          sede_id?: string | null;
          precio_envio?: number | null;
          address?: string | null;
          motivo_cancelacion?: string | null;
        };
      };
      clientes: {
        Row: {
          id: number; // bigint
          nombre: string | null;
          telefono: string | null;
          direccion: string | null;
          updated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          nombre?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          updated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          nombre?: string | null;
          telefono?: string | null;
          direccion?: string | null;
          updated_at?: string | null;
          created_at?: string;
        };
      };
      repartidores: {
        Row: {
          id: number; // bigint
          disponible: boolean | null;
          nombre: string | null;
          telefono: string | null;
          placas: string | null;
          created_at: string;
          sede_asignada: string | null; // uuid
        };
        Insert: {
          id?: number;
          disponible?: boolean | null;
          nombre?: string | null;
          telefono?: string | null;
          placas?: string | null;
          created_at?: string;
          sede_asignada?: string | null;
        };
        Update: {
          id?: number;
          disponible?: boolean | null;
          nombre?: string | null;
          telefono?: string | null;
          placas?: string | null;
          created_at?: string;
          sede_asignada?: string | null;
        };
      };
      pagos: {
        Row: {
          id: number; // bigint
          type: string | null;
          token: string | null;
          status: string | null;
          updated_at: string | null;
          created_at: string;
          total_pago: number | null; // bigint
        };
        Insert: {
          id?: number;
          type?: string | null;
          token?: string | null;
          status?: string | null;
          updated_at?: string | null;
          created_at?: string;
          total_pago?: number | null;
        };
        Update: {
          id?: number;
          type?: string | null;
          token?: string | null;
          status?: string | null;
          updated_at?: string | null;
          created_at?: string;
          total_pago?: number | null;
        };
      };
      ordenes_platos: {
        Row: {
          id: number; // bigint
          created_at: string;
          orden_id: number | null; // bigint
          plato_id: number | null; // bigint
        };
        Insert: {
          id?: number;
          created_at?: string;
          orden_id?: number | null;
          plato_id?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          orden_id?: number | null;
          plato_id?: number | null;
        };
      };
      ordenes_bebidas: {
        Row: {
          id: number; // bigint
          created_at: string;
          orden_id: number | null; // bigint
          bebidas_id: number | null; // smallint
        };
        Insert: {
          id?: number;
          created_at?: string;
          orden_id?: number | null;
          bebidas_id?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          orden_id?: number | null;
          bebidas_id?: number | null;
        };
      };
      ordenes_toppings: {
        Row: {
          id: number; // bigint
          created_at: string;
          orden_id: number | null; // bigint
          topping_id: number | null; // integer
        };
        Insert: {
          id?: number;
          created_at?: string;
          orden_id?: number | null;
          topping_id?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          orden_id?: number | null;
          topping_id?: number | null;
        };
      };
      minutas: {
        Row: {
          id: number; // bigint
          order_id: number | null; // bigint
          sede_id: string | null; // uuid
          dia: string | null; // date
          daily_id: number | null; // integer
          created_at: string;
        };
        Insert: {
          id?: number;
          order_id?: number | null;
          sede_id?: string | null;
          dia?: string | null;
          daily_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          order_id?: number | null;
          sede_id?: string | null;
          dia?: string | null;
          daily_id?: number | null;
          created_at?: string;
        };
      };
      daily_minuta_counters_sede: {
        Row: {
          fecha: string; // date
          sede_id: string; // uuid
          last_value: number; // integer
        };
        Insert: {
          fecha: string;
          sede_id: string;
          last_value: number;
        };
        Update: {
          fecha?: string;
          sede_id?: string;
          last_value?: number;
        };
      };
    };
  };
}
