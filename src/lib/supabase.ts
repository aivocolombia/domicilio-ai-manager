import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '@/config/api';

// Verificar configuración antes de crear el cliente
if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
  console.error('ERROR: Variables de entorno de Supabase no configuradas');
  throw new Error('Variables de entorno de Supabase no configuradas');
}

// Crear cliente de Supabase
export const supabase = createClient(
  SUPABASE_CONFIG.URL,
  SUPABASE_CONFIG.ANON_KEY
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
          email: string;
          name: string;
          role: string | null;
          sede_id: string | null; // uuid
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: string | null;
          sede_id?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: string | null;
          sede_id?: string | null;
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
          payment_id: number | null; // bigint
          time: number | null; // integer
          add_time: number | null; // integer
          razon_tiempo_extra: string | null;
          hora_entrega: string | null; // timestamp with time zone
          created_at: string;
          observaciones: string | null;
          cliente_id: number | null; // bigint
          sede_id: string | null; // uuid
        };
        Insert: {
          id?: number;
          repartidor_id?: number | null;
          date?: string | null;
          status?: string | null;
          payment_id?: number | null;
          time?: number | null;
          add_time?: number | null;
          razon_tiempo_extra?: string | null;
          hora_entrega?: string | null;
          created_at?: string;
          observaciones?: string | null;
          cliente_id?: number | null;
          sede_id?: string | null;
        };
        Update: {
          id?: number;
          repartidor_id?: number | null;
          date?: string | null;
          status?: string | null;
          payment_id?: number | null;
          time?: number | null;
          add_time?: number | null;
          razon_tiempo_extra?: string | null;
          hora_entrega?: string | null;
          created_at?: string;
          observaciones?: string | null;
          cliente_id?: number | null;
          sede_id?: string | null;
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
    };
  };
}