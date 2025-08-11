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

// Tipos para las tablas de Supabase
export interface Database {
  public: {
    Tables: {
      platos: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          pricing: number;
          available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          pricing: number;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          pricing?: number;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      toppings: {
        Row: {
          id: number;
          name: string;
          pricing: number;
          available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          pricing: number;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          pricing?: number;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      plato_toppings: {
        Row: {
          id: number;
          plato_id: number;
          topping_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          plato_id: number;
          topping_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          plato_id?: number;
          topping_id?: number;
          created_at?: string;
        };
      };
      bebidas: {
        Row: {
          id: number;
          name: string;
          pricing: number;
          available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          pricing: number;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          pricing?: number;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}