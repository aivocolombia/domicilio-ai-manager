import { supabase } from '@/lib/supabase';
import type { SubstitutionDetails } from './substitutionService';

export interface SubstitutionHistoryRecord {
  id: string;
  orden_id: number;
  item_type: 'plato' | 'bebida' | 'topping';
  item_id: number;
  orden_item_id?: number; // ID específico del item individual en ordenes_platos/bebidas/toppings
  substitution_type: 'product_substitution' | 'topping_substitution';
  original_name: string;
  substitute_name: string;
  price_difference: number;
  parent_item_name?: string;
  created_at: string;
  applied_at: string;
}

export class SubstitutionHistoryService {

  /**
   * Crear la tabla de historial de sustituciones si no existe
   */
  async initializeTable(): Promise<boolean> {
    try {
      console.log('🔧 Inicializando tabla de historial de sustituciones...');

      // Ejecutar el SQL para crear la tabla
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          -- Crear tabla para almacenar historial de sustituciones
          CREATE TABLE IF NOT EXISTS order_substitution_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            orden_id INTEGER NOT NULL,
            item_type TEXT NOT NULL CHECK (item_type IN ('plato', 'bebida', 'topping')),
            item_id INTEGER NOT NULL,
            substitution_type TEXT NOT NULL CHECK (substitution_type IN ('product_substitution', 'topping_substitution')),
            original_name TEXT NOT NULL,
            substitute_name TEXT NOT NULL,
            price_difference DECIMAL(10,2) NOT NULL DEFAULT 0,
            parent_item_name TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Índices para mejorar el rendimiento
          CREATE INDEX IF NOT EXISTS idx_substitution_history_orden_id ON order_substitution_history(orden_id);
          CREATE INDEX IF NOT EXISTS idx_substitution_history_created_at ON order_substitution_history(created_at);

          -- RLS (Row Level Security)
          ALTER TABLE order_substitution_history ENABLE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS "Users can view substitution history" ON order_substitution_history;
          CREATE POLICY "Users can view substitution history" ON order_substitution_history
            FOR SELECT USING (true);

          DROP POLICY IF EXISTS "Users can insert substitution history" ON order_substitution_history;
          CREATE POLICY "Users can insert substitution history" ON order_substitution_history
            FOR INSERT WITH CHECK (true);
        `
      });

      if (error) {
        console.error('❌ Error inicializando tabla:', error);
        return false;
      }

      console.log('✅ Tabla de historial de sustituciones inicializada correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error en initializeTable:', error);
      return false;
    }
  }

  /**
   * Guardar una sustitución en el historial
   */
  async recordSubstitution(
    ordenId: number,
    itemType: 'plato' | 'bebida' | 'topping',
    itemId: number,
    substitutionDetail: SubstitutionDetails,
    ordenItemId?: number // ID específico del item individual
  ): Promise<boolean> {
    try {
      console.log('💾 Guardando sustitución en historial:', {
        ordenId,
        itemType,
        itemId,
        substitutionDetail
      });

      const { error } = await supabase
        .from('order_substitution_history')
        .insert({
          orden_id: ordenId,
          item_type: itemType,
          item_id: itemId,
          orden_item_id: ordenItemId, // Agregar ID específico del item
          substitution_type: substitutionDetail.type,
          original_name: substitutionDetail.original_name,
          substitute_name: substitutionDetail.substitute_name,
          price_difference: substitutionDetail.price_difference,
          parent_item_name: substitutionDetail.parent_item_name
        });

      if (error) {
        // Si la tabla no existe, mostrar mensaje informativo
        if (error.message.includes('relation "order_substitution_history" does not exist')) {
          console.warn('⚠️ Tabla de historial de sustituciones no existe. Ejecute create_substitution_table.sql');
          return false;
        }
        console.error('❌ Error guardando sustitución:', error);
        return false;
      }

      console.log('✅ Sustitución guardada en historial');
      return true;
    } catch (error) {
      console.error('❌ Error en recordSubstitution:', error);
      return false;
    }
  }

  /**
   * Guardar múltiples sustituciones en el historial
   */
  async recordMultipleSubstitutions(
    ordenId: number,
    substitutions: Array<{
      itemType: 'plato' | 'bebida' | 'topping';
      itemId: number;
      ordenItemId?: number; // ID específico del item individual
      substitutionDetail: SubstitutionDetails;
    }>
  ): Promise<boolean> {
    try {
      console.log('💾 Guardando múltiples sustituciones en historial:', substitutions.length);

      const records = substitutions.map(sub => {
        const record = {
          orden_id: ordenId,
          item_type: sub.itemType,
          item_id: sub.itemId,
          orden_item_id: sub.ordenItemId, // Agregar ID específico del item
          substitution_type: sub.substitutionDetail.type,
          original_name: sub.substitutionDetail.original_name,
          substitute_name: sub.substitutionDetail.substitute_name,
          price_difference: sub.substitutionDetail.price_difference,
          parent_item_name: sub.substitutionDetail.parent_item_name
        };

        console.log('🔍 DEBUG substitutionHistoryService: Record a insertar:', record);
        console.log('🔍 DEBUG substitutionHistoryService: Sub object details:', {
          subOrdenItemId: sub.ordenItemId,
          subSubstitutionDetail: sub.substitutionDetail,
          subSubstitutionDetailOrdenItemId: sub.substitutionDetail.orden_item_id
        });
        return record;
      });

      const { error } = await supabase
        .from('order_substitution_history')
        .insert(records);

      if (error) {
        // Si la tabla no existe, mostrar mensaje informativo
        if (error.message.includes('relation "order_substitution_history" does not exist')) {
          console.warn('⚠️ Tabla de historial de sustituciones no existe. Ejecute create_substitution_table.sql');
          return false;
        }
        console.error('❌ Error guardando sustituciones múltiples:', error);
        return false;
      }

      console.log('✅ Múltiples sustituciones guardadas en historial');
      return true;
    } catch (error) {
      console.error('❌ Error en recordMultipleSubstitutions:', error);
      return false;
    }
  }

  /**
   * Obtener el historial de sustituciones de una orden
   */
  async getOrderSubstitutionHistory(ordenId: number): Promise<SubstitutionHistoryRecord[]> {
    try {
      console.log('🔍 Obteniendo historial de sustituciones para orden:', ordenId);

      const { data, error } = await supabase
        .from('order_substitution_history')
        .select('*')
        .eq('orden_id', ordenId)
        .order('applied_at', { ascending: true });

      if (error) {
        // Si la tabla no existe, devolver array vacío
        if (error.message.includes('relation "order_substitution_history" does not exist')) {
          console.warn('⚠️ Tabla de historial de sustituciones no existe. Ejecute create_substitution_table.sql');
          return [];
        }
        console.error('❌ Error obteniendo historial de sustituciones:', error);
        return [];
      }

      console.log('✅ Historial de sustituciones obtenido:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Error en getOrderSubstitutionHistory:', error);
      return [];
    }
  }

  /**
   * Limpiar historial de sustituciones de una orden
   */
  async clearOrderSubstitutionHistory(ordenId: number): Promise<boolean> {
    try {
      console.log('🗑️ Limpiando historial de sustituciones para orden:', ordenId);

      const { error } = await supabase
        .from('order_substitution_history')
        .delete()
        .eq('orden_id', ordenId);

      if (error) {
        console.error('❌ Error limpiando historial:', error);
        return false;
      }

      console.log('✅ Historial limpiado correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error en clearOrderSubstitutionHistory:', error);
      return false;
    }
  }
}

// Instancia singleton del servicio
export const substitutionHistoryService = new SubstitutionHistoryService();