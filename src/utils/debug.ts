import { supabase } from '@/lib/supabase';

// Utilidad para debuggear variables de ambiente en el frontend
export function debugEnv() {
  console.log('🔍 Debugging environment variables...')
  console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
  console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Presente' : 'Ausente')
  
  // Verificar si las variables están definidas
  if (!import.meta.env.VITE_SUPABASE_URL) {
    console.error('❌ VITE_SUPABASE_URL no está definida')
  }
  
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY no está definida')
  }
  
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.log('✅ Todas las variables de ambiente están presentes')
  }
}

// Función para verificar la conexión de Supabase
export async function testSupabaseConnection() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Variables de ambiente faltantes')
      return false
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Probar conexión básica
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Error de conexión:', error.message)
      return false
    }
    
    console.log('✅ Conexión a Supabase exitosa')
    return true
  } catch (error) {
    console.error('❌ Error general:', error)
    return false
  }
}

export const debugUtils = {
  // Verificar el estado de una bebida específica
  async checkBebidaStatus(bebidaName: string, sedeId: string) {
    try {
      console.log('🔍 Debug: Verificando estado de bebida:', { bebidaName, sedeId });
      
      // 1. Buscar la bebida en la tabla bebidas
      const { data: bebida, error: bebidaError } = await supabase
        .from('bebidas')
        .select('*')
        .ilike('name', `%${bebidaName}%`)
        .single();

      if (bebidaError) {
        console.error('❌ Error al buscar bebida:', bebidaError);
        return { error: bebidaError.message };
      }

      console.log('✅ Bebida encontrada:', bebida);

      // 2. Verificar si existe registro en sede_bebidas
      const { data: sedeBebida, error: sedeBebidaError } = await supabase
        .from('sede_bebidas')
        .select('*')
        .eq('sede_id', sedeId)
        .eq('bebida_id', bebida.id)
        .single();

      if (sedeBebidaError && sedeBebidaError.code !== 'PGRST116') {
        console.error('❌ Error al buscar sede_bebida:', sedeBebidaError);
        return { error: sedeBebidaError.message };
      }

      console.log('✅ Estado en sede_bebidas:', sedeBebida || 'No existe registro');

      return {
        bebida,
        sedeBebida,
        exists: !!sedeBebida
      };
    } catch (error) {
      console.error('❌ Error en checkBebidaStatus:', error);
      return { error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  },

  // Crear registro faltante para una bebida
  async createSedeBebidaRecord(sedeId: string, bebidaId: number) {
    try {
      console.log('➕ Creando registro sede_bebida:', { sedeId, bebidaId });
      
      const { data, error } = await supabase
        .from('sede_bebidas')
        .insert({
          sede_id: sedeId,
          bebida_id: bebidaId,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear registro:', error);
        return { error: error.message };
      }

      console.log('✅ Registro creado:', data);
      return { data };
    } catch (error) {
      console.error('❌ Error en createSedeBebidaRecord:', error);
      return { error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  },

  // Verificar todas las bebidas de una sede
  async checkAllBebidasInSede(sedeId: string) {
    try {
      console.log('🔍 Debug: Verificando todas las bebidas en sede:', sedeId);
      
      const { data: bebidas, error: bebidasError } = await supabase
        .from('bebidas')
        .select('*')
        .order('name');

      if (bebidasError) {
        console.error('❌ Error al obtener bebidas:', bebidasError);
        return { error: bebidasError.message };
      }

      const { data: sedeBebidas, error: sedeBebidasError } = await supabase
        .from('sede_bebidas')
        .select('*')
        .eq('sede_id', sedeId);

      if (sedeBebidasError) {
        console.error('❌ Error al obtener sede_bebidas:', sedeBebidasError);
        return { error: sedeBebidasError.message };
      }

      const sedeBebidasMap = new Map(sedeBebidas.map(sb => [sb.bebida_id, sb]));
      
      const result = bebidas.map(bebida => ({
        bebida,
        sedeRecord: sedeBebidasMap.get(bebida.id),
        hasRecord: sedeBebidasMap.has(bebida.id)
      }));

      console.log('✅ Estado de bebidas en sede:', result);
      return { data: result };
    } catch (error) {
      console.error('❌ Error en checkAllBebidasInSede:', error);
      return { error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  },

  // Verificar el estado de un topping específico
  async checkToppingStatus(toppingName: string, sedeId: string) {
    try {
      console.log('🔍 Debug: Verificando estado de topping:', { toppingName, sedeId });
      
      // 1. Buscar el topping en la tabla toppings
      const { data: topping, error: toppingError } = await supabase
        .from('toppings')
        .select('*')
        .ilike('name', `%${toppingName}%`)
        .single();

      if (toppingError) {
        console.error('❌ Error al buscar topping:', toppingError);
        return { error: toppingError.message };
      }

      console.log('✅ Topping encontrado:', topping);

      // 2. Verificar si existe registro en sede_toppings
      const { data: sedeTopping, error: sedeToppingError } = await supabase
        .from('sede_toppings')
        .select('*')
        .eq('sede_id', sedeId)
        .eq('topping_id', topping.id)
        .single();

      if (sedeToppingError && sedeToppingError.code !== 'PGRST116') {
        console.error('❌ Error al buscar sede_topping:', sedeToppingError);
        return { error: sedeToppingError.message };
      }

      console.log('✅ Estado en sede_toppings:', sedeTopping || 'No existe registro');

      return {
        topping,
        sedeTopping,
        exists: !!sedeTopping
      };
    } catch (error) {
      console.error('❌ Error en checkToppingStatus:', error);
      return { error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  },

  // Crear registro faltante para un topping
  async createSedeToppingRecord(sedeId: string, toppingId: number) {
    try {
      console.log('➕ Creando registro sede_topping:', { sedeId, toppingId });
      
      const { data, error } = await supabase
        .from('sede_toppings')
        .insert({
          sede_id: sedeId,
          topping_id: toppingId,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear registro:', error);
        return { error: error.message };
      }

      console.log('✅ Registro creado:', data);
      return { data };
    } catch (error) {
      console.error('❌ Error en createSedeToppingRecord:', error);
      return { error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  },

  // Verificar todos los toppings de una sede
  async checkAllToppingsInSede(sedeId: string) {
    try {
      console.log('🔍 Debug: Verificando todos los toppings en sede:', sedeId);
      
      const { data: toppings, error: toppingsError } = await supabase
        .from('toppings')
        .select('*')
        .order('name');

      if (toppingsError) {
        console.error('❌ Error al obtener toppings:', toppingsError);
        return { error: toppingsError.message };
      }

      const { data: sedeToppings, error: sedeToppingsError } = await supabase
        .from('sede_toppings')
        .select('*')
        .eq('sede_id', sedeId);

      if (sedeToppingsError) {
        console.error('❌ Error al obtener sede_toppings:', sedeToppingsError);
        return { error: sedeToppingsError.message };
      }

      const sedeToppingsMap = new Map(sedeToppings.map(st => [st.topping_id, st]));
      
      const result = toppings.map(topping => ({
        topping,
        sedeRecord: sedeToppingsMap.get(topping.id),
        hasRecord: sedeToppingsMap.has(topping.id)
      }));

      console.log('✅ Estado de toppings en sede:', result);
      return { data: result };
    } catch (error) {
      console.error('❌ Error en checkAllToppingsInSede:', error);
      return { error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }
}; 