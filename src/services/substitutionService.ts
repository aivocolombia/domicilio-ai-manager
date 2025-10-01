import { supabase } from '@/lib/supabase';

export interface SubstitutionRule {
  id: number;
  original_product_id: number;
  original_product_type: 'plato' | 'bebida' | 'topping';
  substitute_product_id: number;
  substitute_product_type: 'plato' | 'bebida' | 'topping';
  price_difference: number;
  is_bidirectional: boolean;
  is_active: boolean;
  notes?: string;
}

export interface AvailableSubstitution {
  substitute_id: number;
  substitute_type: 'plato' | 'bebida' | 'topping';
  substitute_name: string;
  price_difference: number;
  is_bidirectional: boolean;
}

export interface SubstitutionResult {
  success: boolean;
  message: string;
  original_item?: any;
  substitute_item?: any;
  price_change?: number;
  substitution_details?: SubstitutionDetails;
}

export interface SubstitutionDetails {
  type: 'product_substitution' | 'topping_substitution';
  original_name: string;
  substitute_name: string;
  price_difference: number;
  parent_item_name?: string; // Para toppings, el nombre del plato padre
  orden_item_id?: number; // ID específico del item individual en ordenes_platos/bebidas/toppings
}

export interface PlatoTopping {
  id: number;
  plato_id: number;
  topping_id: number;
  topping_name: string;
  topping_pricing: number;
}

export class SubstitutionService {

  /**
   * Obtiene las sustituciones disponibles para un producto específico
   * Usando consulta directa en lugar de función SQL problemática
   */
  async getAvailableSubstitutions(
    productId: number,
    productType: 'plato' | 'bebida' | 'topping'
  ): Promise<AvailableSubstitution[]> {
    try {
      console.log('🔄 SubstitutionService: Obteniendo sustituciones para', { productId, productType });

      // Obtener reglas donde el producto es el original
      const { data: directRules, error: directError } = await supabase
        .from('product_substitution_rules')
        .select('substitute_product_id, substitute_product_type, price_difference, is_bidirectional')
        .eq('original_product_id', productId)
        .eq('original_product_type', productType)
        .eq('is_active', true);

      if (directError) {
        console.error('❌ Error obteniendo reglas directas:', directError);
      }

      // Obtener reglas bidireccionales donde el producto es el sustituto
      const { data: inverseRules, error: inverseError } = await supabase
        .from('product_substitution_rules')
        .select('original_product_id, original_product_type, price_difference, is_bidirectional')
        .eq('substitute_product_id', productId)
        .eq('substitute_product_type', productType)
        .eq('is_active', true)
        .eq('is_bidirectional', true);

      if (inverseError) {
        console.error('❌ Error obteniendo reglas inversas:', inverseError);
      }

      const substitutions: AvailableSubstitution[] = [];

      // Procesar reglas directas
      for (const rule of directRules || []) {
        const productInfo = await this.getProductInfo(rule.substitute_product_id, rule.substitute_product_type);
        if (productInfo) {
          substitutions.push({
            substitute_id: rule.substitute_product_id,
            substitute_type: rule.substitute_product_type,
            substitute_name: productInfo.name,
            price_difference: rule.price_difference,
            is_bidirectional: rule.is_bidirectional
          });
        }
      }

      // Procesar reglas inversas (bidireccionales)
      for (const rule of inverseRules || []) {
        const productInfo = await this.getProductInfo(rule.original_product_id, rule.original_product_type);
        if (productInfo) {
          substitutions.push({
            substitute_id: rule.original_product_id,
            substitute_type: rule.original_product_type,
            substitute_name: productInfo.name,
            price_difference: -rule.price_difference, // Invertir el precio
            is_bidirectional: rule.is_bidirectional
          });
        }
      }

      console.log('✅ Sustituciones encontradas:', substitutions.length);
      return substitutions;
    } catch (error) {
      console.error('❌ Error en getAvailableSubstitutions:', error);
      return [];
    }
  }

  /**
   * Verifica si un producto puede ser sustituido por otro
   */
  async canSubstitute(
    originalId: number,
    originalType: 'plato' | 'bebida' | 'topping',
    substituteId: number,
    substituteType: 'plato' | 'bebida' | 'topping'
  ): Promise<{ canSubstitute: boolean; priceDifference?: number; rule?: SubstitutionRule }> {
    try {
      // Buscar regla directa
      const { data: directRule, error: directError } = await supabase
        .from('product_substitution_rules')
        .select('*')
        .eq('original_product_id', originalId)
        .eq('original_product_type', originalType)
        .eq('substitute_product_id', substituteId)
        .eq('substitute_product_type', substituteType)
        .eq('is_active', true)
        .maybeSingle();

      if (directError) {
        console.error('Error buscando regla directa:', directError);
      }

      if (directRule) {
        return {
          canSubstitute: true,
          priceDifference: directRule.price_difference,
          rule: directRule
        };
      }

      // Buscar regla bidireccional inversa
      const { data: inverseRule, error: inverseError } = await supabase
        .from('product_substitution_rules')
        .select('*')
        .eq('original_product_id', substituteId)
        .eq('original_product_type', substituteType)
        .eq('substitute_product_id', originalId)
        .eq('substitute_product_type', originalType)
        .eq('is_active', true)
        .eq('is_bidirectional', true)
        .maybeSingle();

      if (inverseError) {
        console.error('Error buscando regla inversa:', inverseError);
      }

      if (inverseRule) {
        return {
          canSubstitute: true,
          priceDifference: -inverseRule.price_difference, // Invertir la diferencia
          rule: inverseRule
        };
      }

      return { canSubstitute: false };
    } catch (error) {
      console.error('❌ Error en canSubstitute:', error);
      return { canSubstitute: false };
    }
  }

  /**
   * Obtiene información completa de un producto (plato, bebida o topping)
   */
  async getProductInfo(productId: number, productType: 'plato' | 'bebida' | 'topping') {
    try {
      let tableName: string;
      switch (productType) {
        case 'plato': tableName = 'platos'; break;
        case 'bebida': tableName = 'bebidas'; break;
        case 'topping': tableName = 'toppings'; break;
        default: throw new Error(`Tipo de producto no válido: ${productType}`);
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', productId)
        .not('name', 'like', '%_DUPLICADO_%') // Filtrar duplicados marcados
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`❌ Error obteniendo info de ${productType}:`, error);
      return null;
    }
  }

  /**
   * Aplica una sustitución en un item de orden
   * Esta función prepara los datos para que EditOrderModal pueda aplicar el cambio
   */
  async prepareSubstitution(
    originalItem: any,
    substituteId: number,
    substituteType: 'plato' | 'bebida' | 'topping'
  ): Promise<SubstitutionResult> {
    try {
      console.log('🔄 Preparando sustitución:', { originalItem, substituteId, substituteType });

      // Obtener información del producto sustituto
      const substituteProduct = await this.getProductInfo(substituteId, substituteType);
      if (!substituteProduct) {
        return {
          success: false,
          message: 'No se pudo obtener información del producto sustituto'
        };
      }

      // Verificar si la sustitución es válida
      const substitutionCheck = await this.canSubstitute(
        originalItem.producto_id,
        originalItem.tipo,
        substituteId,
        substituteType
      );

      if (!substitutionCheck.canSubstitute) {
        return {
          success: false,
          message: 'Esta sustitución no está permitida según las reglas configuradas'
        };
      }

      // Calcular nuevo precio unitario
      const originalPrice = originalItem.precio_unitario;
      const priceDifference = substitutionCheck.priceDifference || 0;
      const newUnitPrice = Math.max(0, originalPrice + priceDifference);
      const newTotalPrice = newUnitPrice * originalItem.cantidad;

      // Crear el item sustituido
      const substitutedItem = {
        ...originalItem,
        producto_id: substituteId,
        tipo: substituteType,
        nombre: substituteProduct.name,
        precio_unitario: newUnitPrice,
        precio_total: newTotalPrice
      };

      console.log('✅ Sustitución preparada exitosamente');

      return {
        success: true,
        message: `${originalItem.nombre} → ${substituteProduct.name}`,
        original_item: originalItem,
        substitute_item: substitutedItem,
        price_change: priceDifference * originalItem.cantidad,
        substitution_details: {
          type: 'product_substitution',
          original_name: originalItem.nombre,
          substitute_name: substituteProduct.name,
          price_difference: priceDifference
        }
      };

    } catch (error) {
      console.error('❌ Error preparando sustitución:', error);
      return {
        success: false,
        message: 'Error interno al preparar la sustitución'
      };
    }
  }

  /**
   * Prepara una sustitución de topping con detalles completos
   */
  async prepareToppingSubstitution(
    platoItem: any,
    originalToppingId: number,
    originalToppingName: string,
    originalToppingPrice: number,
    substituteToppingId: number,
    substituteToppingName: string,
    substituteToppingPrice: number
  ): Promise<SubstitutionResult> {
    try {
      console.log('🔄 Preparando sustitución de topping:', {
        plato: platoItem.nombre,
        original: originalToppingName,
        substitute: substituteToppingName
      });

      // IMPORTANTE: Las sustituciones de toppings son GRATUITAS - no cambian el precio
      const priceDifference = 0; // Siempre 0 para toppings
      const newPlatoPrice = platoItem.precio_unitario; // Mantener precio original
      const newTotalPrice = newPlatoPrice * platoItem.cantidad;

      const updatedItem = {
        ...platoItem,
        precio_unitario: newPlatoPrice,
        precio_total: newTotalPrice
      };

      return {
        success: true,
        message: `${originalToppingName} → ${substituteToppingName} en ${platoItem.nombre} (sin costo adicional)`,
        original_item: platoItem,
        substitute_item: updatedItem,
        price_change: 0, // Siempre 0 para toppings
        substitution_details: {
          type: 'topping_substitution',
          original_name: originalToppingName,
          substitute_name: substituteToppingName,
          price_difference: 0, // Siempre 0 para toppings
          parent_item_name: platoItem.nombre
        }
      };

    } catch (error) {
      console.error('❌ Error preparando sustitución de topping:', error);
      return {
        success: false,
        message: 'Error preparando sustitución de topping'
      };
    }
  }

  /**
   * Obtiene todas las reglas de sustitución activas (para administración)
   */
  async getAllSubstitutionRules(): Promise<SubstitutionRule[]> {
    try {
      const { data, error } = await supabase
        .from('product_substitution_rules')
        .select(`
          *,
          original_product:original_product_id (name),
          substitute_product:substitute_product_id (name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error obteniendo reglas de sustitución:', error);
      return [];
    }
  }

  /**
   * Crea una nueva regla de sustitución (para administradores)
   */
  async createSubstitutionRule(rule: Omit<SubstitutionRule, 'id'>): Promise<SubstitutionRule | null> {
    try {
      const { data, error } = await supabase
        .from('product_substitution_rules')
        .insert([rule])
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Regla de sustitución creada:', data);
      return data;
    } catch (error) {
      console.error('❌ Error creando regla de sustitución:', error);
      return null;
    }
  }

  /**
   * Desactiva una regla de sustitución
   */
  async deactivateSubstitutionRule(ruleId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('product_substitution_rules')
        .update({ is_active: false })
        .eq('id', ruleId);

      if (error) throw error;
      console.log('✅ Regla de sustitución desactivada:', ruleId);
      return true;
    } catch (error) {
      console.error('❌ Error desactivando regla:', error);
      return false;
    }
  }

  /**
   * Obtiene los toppings incluidos en un plato específico
   */
  async getPlatoToppings(platoId: number): Promise<PlatoTopping[]> {
    try {
      console.log('🔄 Obteniendo toppings para plato ID:', platoId);

      // Primero obtener las relaciones plato-topping
      const { data: relaciones, error: relacionesError } = await supabase
        .from('plato_toppings')
        .select('id, plato_id, topping_id')
        .eq('plato_id', platoId);

      if (relacionesError) {
        console.error('❌ Error obteniendo relaciones plato-topping:', relacionesError);
        throw relacionesError;
      }

      if (!relaciones || relaciones.length === 0) {
        console.log('ℹ️ No se encontraron toppings para el plato ID:', platoId);
        return [];
      }

      const toppings: PlatoTopping[] = [];

      // Para cada relación, obtener la información del topping
      for (const relacion of relaciones) {
        const toppingInfo = await this.getProductInfo(relacion.topping_id, 'topping');
        // Solo incluir toppings válidos (no duplicados marcados)
        if (toppingInfo && !toppingInfo.name.includes('_DUPLICADO_')) {
          toppings.push({
            id: relacion.id,
            plato_id: relacion.plato_id,
            topping_id: relacion.topping_id,
            topping_name: toppingInfo.name,
            topping_pricing: toppingInfo.pricing || 0
          });
        }
      }

      console.log('✅ Toppings encontrados:', toppings.length);
      return toppings;
    } catch (error) {
      console.error('❌ Error en getPlatoToppings:', error);
      return [];
    }
  }

  /**
   * Busca productos por nombre para sugerir sustituciones
   */
  async searchProducts(
    query: string,
    productType?: 'plato' | 'bebida' | 'topping'
  ): Promise<Array<{ id: number; name: string; type: string }>> {
    try {
      const results = [];

      // Función helper para buscar en una tabla
      const searchInTable = async (tableName: string, type: string) => {
        const { data, error } = await supabase
          .from(tableName)
          .select('id, name')
          .ilike('name', `%${query}%`)
          .not('name', 'like', '%_DUPLICADO_%') // Filtrar duplicados marcados
          .limit(10);

        if (!error && data) {
          return data.map(item => ({ ...item, type }));
        }
        return [];
      };

      // Buscar según el tipo especificado o en todas las tablas
      if (!productType || productType === 'plato') {
        const platos = await searchInTable('platos', 'plato');
        results.push(...platos);
      }

      if (!productType || productType === 'bebida') {
        const bebidas = await searchInTable('bebidas', 'bebida');
        results.push(...bebidas);
      }

      if (!productType || productType === 'topping') {
        const toppings = await searchInTable('toppings', 'topping');
        results.push(...toppings);
      }

      return results;
    } catch (error) {
      console.error('❌ Error buscando productos:', error);
      return [];
    }
  }
}

// Instancia singleton del servicio
export const substitutionService = new SubstitutionService();