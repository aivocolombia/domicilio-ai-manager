import { 
  Plato, 
  Topping, 
  Bebida, 
  PlatoConToppings, 
  MenuResponse,
  CreatePlatoRequest,
  UpdatePlatoRequest,
  CreateBebidaRequest,
  UpdateBebidaRequest,
  CreateToppingRequest,
  UpdateToppingRequest
} from '@/types/menu';
import { supabase } from '@/lib/supabase';
import { TABLES } from '@/config/api';

class MenuService {
  // Obtener todo el menú (solo productos disponibles - para el menú público)
  async getMenu(): Promise<MenuResponse> {
    try {
      console.log('🔍 Consultando tabla platos:', TABLES.PLATOS);
      
      // Platos
      const { data: platos, error: platosError } = await supabase
        .from(TABLES.PLATOS)
        .select('id, name, description, pricing, available, created_at, updated_at')
        .eq('available', true)
        .order('name', { ascending: true });

      console.log('📊 Resultado consulta platos - data:', platos);
      console.log('📊 Resultado consulta platos - error:', platosError);

      if (platosError) throw platosError;

      console.log('🔍 Consultando tabla toppings:', TABLES.TOPPINGS);
      
      // Toppings disponibles
      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, available, created_at, updated_at')
        .eq('available', true)
        .order('name', { ascending: true });

      console.log('📊 Resultado consulta toppings - data:', allToppings);
      console.log('📊 Resultado consulta toppings - error:', toppingsError);

      if (toppingsError) throw toppingsError;

      console.log('🔍 Consultando tabla plato_toppings:', TABLES.PLATO_TOPPINGS);
      
      // Relaciones plato-toppings
      const { data: platoToppings, error: relationsError } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .select('plato_id, topping_id');

      console.log('📊 Resultado consulta relaciones - data:', platoToppings);
      console.log('📊 Resultado consulta relaciones - error:', relationsError);

      if (relationsError) throw relationsError;

      // Índice de toppings por id para lookup O(1)
      const toppingById = new Map<number, Topping>((allToppings || []).map(t => [t.id, t]));

      // Mapa plato_id -> array topping_id
      const toppingIdsByPlato = new Map<number, number[]>();
      (platoToppings || []).forEach(pt => {
        const arr = toppingIdsByPlato.get(pt.plato_id) || [];
        arr.push(pt.topping_id);
        toppingIdsByPlato.set(pt.plato_id, arr);
      });

      // Construir respuesta de platos con toppings
      const platosConToppings: PlatoConToppings[] = (platos || []).map(plato => {
        const ids = toppingIdsByPlato.get(plato.id) || [];
        const toppings = ids
          .map(id => toppingById.get(id))
          .filter((t): t is Topping => Boolean(t));
        return { ...plato, toppings };
      });

      console.log('🔍 Consultando tabla bebidas:', TABLES.BEBIDAS);
      
      // Bebidas
      const { data: bebidas, error: bebidasError } = await supabase
        .from(TABLES.BEBIDAS)
        .select('id, name, pricing, available, created_at, updated_at')
        .eq('available', true)
        .order('name', { ascending: true });

      console.log('📊 Resultado consulta bebidas - data:', bebidas);
      console.log('📊 Resultado consulta bebidas - error:', bebidasError);

      if (bebidasError) throw bebidasError;

      return { platos: platosConToppings, bebidas: bebidas || [] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener el menú: ${msg}`);
    }
  }

  // Obtener todo el inventario (todos los productos - activos e inactivos)
  async getInventory(): Promise<MenuResponse> {
    try {
      console.log('🔍 Consultando inventario completo...');
      
      // Platos (todos - activos e inactivos)
      const { data: platos, error: platosError } = await supabase
        .from(TABLES.PLATOS)
        .select('id, name, description, pricing, available, created_at, updated_at')
        .order('name', { ascending: true });

      console.log('📊 Resultado consulta platos inventario - data:', platos);
      console.log('📊 Resultado consulta platos inventario - error:', platosError);

      if (platosError) throw platosError;

      // Toppings (todos - activos e inactivos)
      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, available, created_at, updated_at')
        .order('name', { ascending: true });

      console.log('📊 Resultado consulta toppings inventario - data:', allToppings);
      console.log('📊 Resultado consulta toppings inventario - error:', toppingsError);

      if (toppingsError) throw toppingsError;

      // Relaciones plato-toppings
      const { data: platoToppings, error: relationsError } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .select('plato_id, topping_id');

      if (relationsError) throw relationsError;

      // Índice de toppings por id para lookup O(1)
      const toppingById = new Map<number, Topping>((allToppings || []).map(t => [t.id, t]));

      // Mapa plato_id -> array topping_id
      const toppingIdsByPlato = new Map<number, number[]>();
      (platoToppings || []).forEach(pt => {
        const arr = toppingIdsByPlato.get(pt.plato_id) || [];
        arr.push(pt.topping_id);
        toppingIdsByPlato.set(pt.plato_id, arr);
      });

      // Construir respuesta de platos con toppings
      const platosConToppings: PlatoConToppings[] = (platos || []).map(plato => {
        const ids = toppingIdsByPlato.get(plato.id) || [];
        const toppings = ids
          .map(id => toppingById.get(id))
          .filter((t): t is Topping => Boolean(t));
        return { ...plato, toppings };
      });

      // Bebidas (todas - activas e inactivas)
      const { data: bebidas, error: bebidasError } = await supabase
        .from(TABLES.BEBIDAS)
        .select('id, name, pricing, available, created_at, updated_at')
        .order('name', { ascending: true });

      console.log('📊 Resultado consulta bebidas inventario - data:', bebidas);
      console.log('📊 Resultado consulta bebidas inventario - error:', bebidasError);

      if (bebidasError) throw bebidasError;

      console.log('✅ Inventario cargado exitosamente');
      return { 
        platos: platosConToppings, 
        bebidas: bebidas || [],
        toppings: allToppings || [] // Agregar toppings a la respuesta
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener el inventario: ${msg}`);
    }
  }

  // Obtener todos los platos con sus toppings
  async getPlatos(): Promise<PlatoConToppings[]> {
    try {
      const { data: platos, error: platosError } = await supabase
        .from(TABLES.PLATOS)
        .select('id, name, description, pricing, available, created_at, updated_at')
        .order('name', { ascending: true });
      if (platosError) throw platosError;

      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, available, created_at, updated_at')
        .eq('available', true);
      if (toppingsError) throw toppingsError;

      const { data: platoToppings, error: relationsError } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .select('plato_id, topping_id');
      if (relationsError) throw relationsError;

      const toppingById = new Map<number, Topping>((allToppings || []).map(t => [t.id, t]));
      const toppingIdsByPlato = new Map<number, number[]>();
      (platoToppings || []).forEach(pt => {
        const arr = toppingIdsByPlato.get(pt.plato_id) || [];
        arr.push(pt.topping_id);
        toppingIdsByPlato.set(pt.plato_id, arr);
      });

      return (platos || []).map(plato => {
        const ids = toppingIdsByPlato.get(plato.id) || [];
        const toppings = ids
          .map(id => toppingById.get(id))
          .filter((t): t is Topping => Boolean(t));
        return { ...plato, toppings };
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener platos: ${msg}`);
    }
  }

  // Obtener un plato específico por ID
  async getPlato(id: number): Promise<PlatoConToppings> {
    try {
      const { data: plato, error: platoError } = await supabase
        .from(TABLES.PLATOS)
        .select('id, name, description, pricing, available, created_at, updated_at')
        .eq('id', id)
        .single();
      if (platoError) throw platoError;

      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, available, created_at, updated_at')
        .eq('available', true);
      if (toppingsError) throw toppingsError;

      const { data: platoToppings, error: relationsError } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .select('plato_id, topping_id')
        .eq('plato_id', id);
      if (relationsError) throw relationsError;

      const toppingById = new Map<number, Topping>((allToppings || []).map(t => [t.id, t]));
      const toppings = (platoToppings || [])
        .map(pt => toppingById.get(pt.topping_id))
        .filter((t): t is Topping => Boolean(t));

      return { ...plato, toppings };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener plato: ${msg}`);
    }
  }

  // Crear un nuevo plato
  async createPlato(plato: CreatePlatoRequest): Promise<PlatoConToppings> {
    try {
      const { data: newPlato, error } = await supabase
        .from(TABLES.PLATOS)
        .insert({
          name: plato.name,
          description: plato.description,
          pricing: plato.pricing,
          available: plato.available ?? true
        })
        .select('id, name, description, pricing, available, created_at, updated_at')
        .single();
      if (error) throw error;

      if (plato.toppingIds?.length) {
        await this.assignToppingsToPlato(newPlato.id, plato.toppingIds);
        return this.getPlato(newPlato.id);
      }
      return { ...newPlato, toppings: [] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al crear plato: ${msg}`);
    }
  }

  // Actualizar un plato existente
  async updatePlato(id: number, plato: UpdatePlatoRequest): Promise<PlatoConToppings> {
    try {
      const { data: updatedPlato, error } = await supabase
        .from(TABLES.PLATOS)
        .update({
          name: plato.name,
          description: plato.description,
          pricing: plato.pricing,
          available: plato.available
        })
        .eq('id', id)
        .select('id, name, description, pricing, available, created_at, updated_at')
        .single();
      if (error) throw error;

      if (plato.toppingIds) {
        // Reset de relaciones
        const { error: delErr } = await supabase
          .from(TABLES.PLATO_TOPPINGS)
          .delete()
          .eq('plato_id', id);
        if (delErr) throw delErr;

        if (plato.toppingIds.length > 0) {
          await this.assignToppingsToPlato(id, plato.toppingIds);
        }
        return this.getPlato(id);
      }

      // Si no se especificó toppingIds, devolvemos el plato con toppings actuales
      return this.getPlato(id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al actualizar plato: ${msg}`);
    }
  }

  // Eliminar un plato
  async deletePlato(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.PLATOS)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al eliminar plato: ${msg}`);
    }
  }

  // Obtener todas las bebidas
  async getBebidas(): Promise<Bebida[]> {
    try {
      const { data: bebidas, error } = await supabase
        .from(TABLES.BEBIDAS)
        .select('id, name, pricing, available, created_at, updated_at')
        .order('name', { ascending: true });
      if (error) throw error;
      return bebidas || [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener bebidas: ${msg}`);
    }
  }

  // Obtener una bebida por ID
  async getBebida(id: number): Promise<Bebida> {
    try {
      const { data: bebida, error } = await supabase
        .from(TABLES.BEBIDAS)
        .select('id, name, pricing, available, created_at, updated_at')
        .eq('id', id)
        .single();
      if (error) throw error;
      return bebida;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener bebida: ${msg}`);
    }
  }

  // Crear bebida
  async createBebida(bebida: CreateBebidaRequest): Promise<Bebida> {
    try {
      const { data: newBebida, error } = await supabase
        .from(TABLES.BEBIDAS)
        .insert({
          name: bebida.name,
          pricing: bebida.pricing,
          available: bebida.available ?? true
        })
        .select('id, name, pricing, available, created_at, updated_at')
        .single();
      if (error) throw error;
      return newBebida;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al crear bebida: ${msg}`);
    }
  }

  // Actualizar bebida
  async updateBebida(id: number, bebida: UpdateBebidaRequest): Promise<Bebida> {
    try {
      const { data: updatedBebida, error } = await supabase
        .from(TABLES.BEBIDAS)
        .update({
          name: bebida.name,
          pricing: bebida.pricing,
          available: bebida.available
        })
        .eq('id', id)
        .select('id, name, pricing, available, created_at, updated_at')
        .single();
      if (error) throw error;
      return updatedBebida;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al actualizar bebida: ${msg}`);
    }
  }

  // Eliminar bebida
  async deleteBebida(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.BEBIDAS)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al eliminar bebida: ${msg}`);
    }
  }

  // Obtener todos los toppings
  async getToppings(): Promise<Topping[]> {
    try {
      const { data: toppings, error } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, available, created_at, updated_at')
        .order('name', { ascending: true });
      if (error) throw error;
      return toppings || [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener toppings: ${msg}`);
    }
  }

  // Obtener un topping por ID
  async getTopping(id: number): Promise<Topping> {
    try {
      const { data: topping, error } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, available, created_at, updated_at')
        .eq('id', id)
        .single();
      if (error) throw error;
      return topping;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener topping: ${msg}`);
    }
  }

  // Crear topping
  async createTopping(topping: CreateToppingRequest): Promise<Topping> {
    try {
      const { data: newTopping, error } = await supabase
        .from(TABLES.TOPPINGS)
        .insert({
          name: topping.name,
          pricing: topping.pricing,
          available: topping.available ?? true
        })
        .select('id, name, pricing, available, created_at, updated_at')
        .single();
      if (error) throw error;
      return newTopping;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al crear topping: ${msg}`);
    }
  }

  // Actualizar topping
  async updateTopping(id: number, topping: UpdateToppingRequest): Promise<Topping> {
    try {
      const { data: updatedTopping, error } = await supabase
        .from(TABLES.TOPPINGS)
        .update({
          name: topping.name,
          pricing: topping.pricing,
          available: topping.available
        })
        .eq('id', id)
        .select('id, name, pricing, available, created_at, updated_at')
        .single();
      if (error) throw error;
      return updatedTopping;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al actualizar topping: ${msg}`);
    }
  }

  // Eliminar topping
  async deleteTopping(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.TOPPINGS)
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al eliminar topping: ${msg}`);
    }
  }

  // Asignar toppings a un plato
  async assignToppingsToPlato(platoId: number, toppingIds: number[]): Promise<void> {
    try {
      if (!toppingIds?.length) return;
      const rows = toppingIds.map(toppingId => ({
        plato_id: platoId,
        topping_id: toppingId
      }));
      const { error } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .insert(rows);
      if (error) throw error;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al asignar toppings: ${msg}`);
    }
  }

  // Remover toppings de un plato
  async removeToppingsFromPlato(platoId: number, toppingIds: number[]): Promise<void> {
    try {
      if (!toppingIds?.length) return;
      const { error } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .delete()
        .eq('plato_id', platoId)
        .in('topping_id', toppingIds);
      if (error) throw error;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al remover toppings: ${msg}`);
    }
  }
}

export const menuService = new MenuService();
