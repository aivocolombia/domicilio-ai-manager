import { 
  Plato, 
  Topping, 
  Bebida, 
  PlatoConToppings, 
  MenuResponse,
  MenuResponseConSede,
  PlatoConSede,
  BebidaConSede,
  ToppingConSede,
  SedePlato,
  SedeBebida,
  SedeTopping,
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
      // Ejecutar todas las queries en paralelo para mejor rendimiento
      const [platosResult, toppingsResult, relationsResult, bebidasResult] = await Promise.all([
        supabase
          .from(TABLES.PLATOS)
          .select('id, name, description, pricing, created_at, updated_at')
          .order('name', { ascending: true }),
        supabase
          .from(TABLES.TOPPINGS)
          .select('id, name, pricing, created_at, updated_at')
          .order('name', { ascending: true }),
        supabase
          .from(TABLES.PLATO_TOPPINGS)
          .select('plato_id, topping_id'),
        supabase
          .from(TABLES.BEBIDAS)
          .select('id, name, pricing, created_at, updated_at')
          .order('name', { ascending: true })
      ]);

      // Validar errores
      if (platosResult.error) throw platosResult.error;
      if (toppingsResult.error) throw toppingsResult.error;
      if (relationsResult.error) throw relationsResult.error;
      if (bebidasResult.error) throw bebidasResult.error;

      const platos = platosResult.data;
      const allToppings = toppingsResult.data;
      const platoToppings = relationsResult.data;
      const bebidas = bebidasResult.data;

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

      return { platos: platosConToppings, bebidas: bebidas || [] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener el menú: ${msg}`);
    }
  }

  // Obtener menú con información de disponibilidad por sede
  async getMenuConSede(sedeId: string): Promise<MenuResponseConSede> {
    try {
      console.log('🔍 Consultando menú para sede:', sedeId);
      
      // Obtener todos los platos (sin filtrar por available)
      const { data: platos, error: platosError } = await supabase
        .from(TABLES.PLATOS)
        .select('id, name, description, pricing, created_at, updated_at')
        .order('name', { ascending: true });

      if (platosError) throw platosError;

      // Obtener disponibilidad de platos para esta sede
      const { data: sedePlatos, error: sedePlatosError } = await supabase
        .from('sede_platos')
        .select('plato_id, available, price_override, updated_at')
        .eq('sede_id', sedeId);

      if (sedePlatosError) throw sedePlatosError;

      // Crear mapa de disponibilidad por plato
      const sedePlatosMap = new Map<number, SedePlato>();
      (sedePlatos || []).forEach(sp => {
        sedePlatosMap.set(sp.plato_id, {
          sede_id: sedeId,
          plato_id: sp.plato_id,
          available: sp.available,
          price_override: sp.price_override,
          updated_at: sp.updated_at
        });
      });

      // Obtener todos los toppings
      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, created_at, updated_at')
        .order('name', { ascending: true });

      if (toppingsError) throw toppingsError;

      // Obtener disponibilidad de toppings para esta sede
      const { data: sedeToppings, error: sedeToppingsError } = await supabase
        .from('sede_toppings')
        .select('topping_id, available, price_override, updated_at')
        .eq('sede_id', sedeId);

      if (sedeToppingsError) throw sedeToppingsError;

      // Crear mapa de disponibilidad por topping
      const sedeToppingsMap = new Map<number, SedeTopping>();
      (sedeToppings || []).forEach(st => {
        sedeToppingsMap.set(st.topping_id, {
          sede_id: sedeId,
          topping_id: st.topping_id,
          available: st.available,
          price_override: st.price_override,
          updated_at: st.updated_at
        });
      });

      // Obtener relaciones plato-toppings
      const { data: platoToppings, error: relationsError } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .select('plato_id, topping_id');

      if (relationsError) throw relationsError;

      // Crear mapa de toppings por plato
      const toppingIdsByPlato = new Map<number, number[]>();
      (platoToppings || []).forEach(pt => {
        const arr = toppingIdsByPlato.get(pt.plato_id) || [];
        arr.push(pt.topping_id);
        toppingIdsByPlato.set(pt.plato_id, arr);
      });

      console.log('🔗 Relaciones plato-toppings encontradas:', 
        Array.from(toppingIdsByPlato.entries()).map(([platoId, toppingIds]) => 
          `Plato ${platoId}: [${toppingIds.join(', ')}]`
        )
      );

      // Construir toppings con información de sede
      const toppingsConSede: ToppingConSede[] = (allToppings || []).map(topping => {
        const sedeTopping = sedeToppingsMap.get(topping.id);
        return {
          ...topping,
          sede_available: sedeTopping?.available ?? false,
          sede_price: sedeTopping?.price_override ?? topping.pricing
        };
      });

      // Crear mapa de toppings por id
      const toppingById = new Map<number, ToppingConSede>(toppingsConSede.map(t => [t.id, t]));

      // Construir platos con información de sede
      const platosConSede: PlatoConSede[] = (platos || []).map(plato => {
        const sedePlato = sedePlatosMap.get(plato.id);
        const toppingIds = toppingIdsByPlato.get(plato.id) || [];
        const toppings = toppingIds
          .map(id => toppingById.get(id))
          .filter((t): t is ToppingConSede => Boolean(t)); // Mostrar todos los toppings, disponibles o no

        console.log(`🍽️ Plato ${plato.name} (ID: ${plato.id}) tiene ${toppings.length} toppings:`, 
          toppings.map(t => `${t.name} (${t.sede_available ? 'disponible' : 'no disponible'})`));

        return {
          ...plato,
          sede_available: sedePlato?.available ?? false,
          sede_price: sedePlato?.price_override ?? plato.pricing,
          toppings
        };
      });

      // Obtener todas las bebidas
      const { data: bebidas, error: bebidasError } = await supabase
        .from(TABLES.BEBIDAS)
        .select('id, name, pricing, created_at, updated_at')
        .order('name', { ascending: true });

      if (bebidasError) throw bebidasError;

      // Obtener disponibilidad de bebidas para esta sede
      const { data: sedeBebidas, error: sedeBebidasError } = await supabase
        .from('sede_bebidas')
        .select('bebida_id, available, price_override, updated_at')
        .eq('sede_id', sedeId);

      if (sedeBebidasError) throw sedeBebidasError;

      // Crear mapa de disponibilidad por bebida
      const sedeBebidasMap = new Map<number, SedeBebida>();
      (sedeBebidas || []).forEach(sb => {
        sedeBebidasMap.set(sb.bebida_id, {
          sede_id: sedeId,
          bebida_id: sb.bebida_id,
          available: sb.available,
          price_override: sb.price_override,
          updated_at: sb.updated_at
        });
      });

      // Construir bebidas con información de sede
      const bebidasConSede: BebidaConSede[] = (bebidas || []).map(bebida => {
        const sedeBebida = sedeBebidasMap.get(bebida.id);
        const bebidaConSede = {
          ...bebida,
          sede_available: sedeBebida?.available ?? false,
          sede_price: sedeBebida?.price_override ?? bebida.pricing
        };
        
        // Debug específico para Limonada
        if (bebida.name && bebida.name.toLowerCase().includes('limonada')) {
          console.log(`🍋 LIMONADA DEBUG FETCH - ${bebida.name} (ID: ${bebida.id}):`, {
            bebida_base: bebida,
            sedeBebida_raw: sedeBebida,
            sede_available_computed: sedeBebida?.available ?? false,
            sede_price_computed: sedeBebida?.price_override ?? bebida.pricing,
            tiene_registro_sede: !!sedeBebida,
            sedeId: sedeId,
            all_sede_bebidas_for_this_sede: sedeBebidasMap
          });
        }
        
        console.log(`🥤 Bebida ${bebida.name} (ID: ${bebida.id}):`, {
          sede_available: bebidaConSede.sede_available,
          sede_price: bebidaConSede.sede_price,
          tiene_registro_sede: !!sedeBebida
        });
        
        return bebidaConSede;
      });

      return { 
        platos: platosConSede, 
        bebidas: bebidasConSede, 
        toppings: toppingsConSede 
      };
    } catch (error) {
      console.error('❌ Error detallado en getMenuConSede:', error);
      
      // Provide more specific error information
      let msg = 'Error desconocido';
      if (error instanceof Error) {
        msg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        msg = JSON.stringify(error);
      } else {
        msg = String(error);
      }
      
      console.error('💥 Error procesado:', msg);
      throw new Error(`Error al obtener el menú para la sede: ${msg}`);
    }
  }

  // Obtener todo el inventario (todos los productos - activos e inactivos)
  async getInventory(): Promise<MenuResponse> {
    try {
      console.log('🔍 Consultando inventario completo...');
      
      // Platos (todos - activos e inactivos)
      const { data: platos, error: platosError } = await supabase
        .from(TABLES.PLATOS)
        .select('id, name, description, pricing, created_at, updated_at')
        .order('name', { ascending: true });

      console.log('📊 Resultado consulta platos inventario - data:', platos);
      console.log('📊 Resultado consulta platos inventario - error:', platosError);

      if (platosError) throw platosError;

      // Toppings (todos - activos e inactivos)
      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, created_at, updated_at')
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
        .select('id, name, pricing, created_at, updated_at')
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
        .select('id, name, description, pricing, created_at, updated_at')
        .order('name', { ascending: true });
      if (platosError) throw platosError;

      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, created_at, updated_at');
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
        .select('id, name, description, pricing, created_at, updated_at')
        .eq('id', id)
        .single();
      if (platoError) throw platoError;

      const { data: allToppings, error: toppingsError } = await supabase
        .from(TABLES.TOPPINGS)
        .select('id, name, pricing, created_at, updated_at')
        .order('name', { ascending: true });
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
          pricing: plato.pricing
        })
        .select('id, name, description, pricing, created_at, updated_at')
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
          pricing: plato.pricing
        })
        .eq('id', id)
        .select('id, name, description, pricing, created_at, updated_at')
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
        .select('id, name, pricing, created_at, updated_at')
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
        .select('id, name, pricing, created_at, updated_at')
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
          pricing: bebida.pricing
        })
        .select('id, name, pricing, created_at, updated_at')
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
          pricing: bebida.pricing
        })
        .eq('id', id)
        .select('id, name, pricing, created_at, updated_at')
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
        .select('id, name, pricing, created_at, updated_at')
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
        .select('id, name, pricing, created_at, updated_at')
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
          pricing: topping.pricing
        })
        .select('id, name, pricing, created_at, updated_at')
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
          pricing: topping.pricing
        })
        .eq('id', id)
        .select('id, name, pricing, created_at, updated_at')
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

  // Actualizar disponibilidad de un plato para una sede específica
  async updatePlatoSedeAvailability(sedeId: string, platoId: number, available: boolean, priceOverride?: number): Promise<void> {
    try {
      const updateData: any = { 
        available, 
        updated_at: new Date().toISOString() 
      };
      
      if (priceOverride !== undefined) {
        updateData.price_override = priceOverride;
      }

      const { error } = await supabase
        .from('sede_platos')
        .upsert({
          sede_id: sedeId,
          plato_id: platoId,
          ...updateData
        });

      if (error) throw error;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al actualizar disponibilidad del plato para la sede: ${msg}`);
    }
  }

  // Actualizar disponibilidad de una bebida para una sede específica
  async updateBebidaSedeAvailability(sedeId: string, bebidaId: number, available: boolean, priceOverride?: number): Promise<void> {
    try {
      console.log('🥤 Actualizando bebida para sede:', { sedeId, bebidaId, available, priceOverride });
      
      // Primero verificar si el registro existe
      const { data: existingRecord, error: checkError } = await supabase
        .from('sede_bebidas')
        .select('*')
        .eq('sede_id', sedeId)
        .eq('bebida_id', bebidaId)
        .single();

      console.log('🔍 Registro existente:', existingRecord, 'Error:', checkError);
      
      const updateData: any = { 
        available, 
        updated_at: new Date().toISOString() 
      };
      
      if (priceOverride !== undefined) {
        updateData.price_override = priceOverride;
      }

      console.log('📝 Datos a actualizar:', updateData);

      // Debug específico para Limonadas
      if (bebidaId === 1 || bebidaId === 2) {
        console.log('🍋 UPSERT para Limonada:', {
          sede_id: sedeId,
          bebida_id: bebidaId,
          available_value_being_sent: available,
          updateData_complete: updateData,
          data_to_upsert: { sede_id: sedeId, bebida_id: bebidaId, ...updateData }
        });
      }

      // Try update first, then insert if no rows affected
      let result;
      let operation = 'update';
      
      // First try to update existing record
      const { data: updateResult, error: updateError, count } = await supabase
        .from('sede_bebidas')
        .update(updateData)
        .eq('sede_id', sedeId)
        .eq('bebida_id', bebidaId)
        .select();
      
      if (updateError) {
        console.log('❌ Error en update, intentando insert:', updateError);
        operation = 'insert';
        
        // If update failed or no rows affected, insert new record
        const { data: insertResult, error: insertError } = await supabase
          .from('sede_bebidas')
          .insert({
            sede_id: sedeId,
            bebida_id: bebidaId,
            ...updateData
          })
          .select();
          
        result = { data: insertResult, error: insertError };
      } else {
        result = { data: updateResult, error: updateError };
      }
      
      const { data, error } = result;
      
      console.log(`📊 Resultado ${operation}:`, data, 'Error:', error, 'Count:', count);

      if (error) {
        console.error('❌ Error en updateBebidaSedeAvailability:', error);
        throw error;
      }

      console.log('✅ Bebida actualizada exitosamente:', data);
      
      // Verificar que el cambio se aplicó correctamente
      const { data: verificationData, error: verificationError } = await supabase
        .from('sede_bebidas')
        .select('*')
        .eq('sede_id', sedeId)
        .eq('bebida_id', bebidaId)
        .single();
        
      console.log('🔍 Verificación post-update:', verificationData, 'Error:', verificationError);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en updateBebidaSedeAvailability:', error);
      throw new Error(`Error al actualizar disponibilidad de la bebida para la sede: ${msg}`);
    }
  }

  // Actualizar disponibilidad de un topping para una sede específica
  async updateToppingSedeAvailability(sedeId: string, toppingId: number, available: boolean, priceOverride?: number): Promise<void> {
    try {
      console.log('🍯 Actualizando topping para sede:', { sedeId, toppingId, available, priceOverride });
      
      const updateData: any = { 
        available, 
        updated_at: new Date().toISOString() 
      };
      
      if (priceOverride !== undefined) {
        updateData.price_override = priceOverride;
      }

      console.log('📝 Datos a actualizar:', updateData);

      const { data, error } = await supabase
        .from('sede_toppings')
        .upsert({
          sede_id: sedeId,
          topping_id: toppingId,
          ...updateData
        })
        .select();

      if (error) {
        console.error('❌ Error en updateToppingSedeAvailability:', error);
        throw error;
      }

      console.log('✅ Topping actualizado exitosamente:', data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en updateToppingSedeAvailability:', error);
      throw new Error(`Error al actualizar disponibilidad del topping para la sede: ${msg}`);
    }
  }

  // Función para que agentes inicialicen productos de su propia sede
  async initializeSedeProductsForAgent(sedeId: string): Promise<void> {
    try {
      console.log('🔄 Inicializando productos para sede (agente):', sedeId);

      // Obtener todos los platos disponibles
      const { data: platos, error: platosError } = await supabase
        .from('platos')
        .select('id');

      if (platosError) {
        console.error('❌ Error obteniendo platos:', platosError);
        throw platosError;
      }

      // Obtener todas las bebidas disponibles
      const { data: bebidas, error: bebidasError } = await supabase
        .from('bebidas')
        .select('id');

      if (bebidasError) {
        console.error('❌ Error obteniendo bebidas:', bebidasError);
        throw bebidasError;
      }

      // Obtener todos los toppings disponibles
      const { data: toppings, error: toppingsError } = await supabase
        .from('toppings')
        .select('id');

      if (toppingsError) {
        console.error('❌ Error obteniendo toppings:', toppingsError);
        throw toppingsError;
      }

      // Insertar relaciones para platos (usando upsert para evitar duplicados)
      if (platos && platos.length > 0) {
        const platosData = platos.map(plato => ({
          sede_id: sedeId,
          plato_id: plato.id,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        }));

        const { error: platosInsertError } = await supabase
          .from('sede_platos')
          .upsert(platosData, { onConflict: 'sede_id,plato_id' });

        if (platosInsertError) {
          console.error('❌ Error insertando sede_platos:', platosInsertError);
        } else {
          console.log('✅ Platos inicializados:', platos.length);
        }
      }

      // Insertar relaciones para bebidas (usando upsert para evitar duplicados)
      if (bebidas && bebidas.length > 0) {
        const bebidasData = bebidas.map(bebida => ({
          sede_id: sedeId,
          bebida_id: bebida.id,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        }));

        const { error: bebidasInsertError } = await supabase
          .from('sede_bebidas')
          .upsert(bebidasData, { onConflict: 'sede_id,bebida_id' });

        if (bebidasInsertError) {
          console.error('❌ Error insertando sede_bebidas:', bebidasInsertError);
        } else {
          console.log('✅ Bebidas inicializadas:', bebidas.length);
        }
      }

      // Insertar relaciones para toppings (usando upsert para evitar duplicados)
      if (toppings && toppings.length > 0) {
        const toppingsData = toppings.map(topping => ({
          sede_id: sedeId,
          topping_id: topping.id,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        }));

        const { error: toppingsInsertError } = await supabase
          .from('sede_toppings')
          .upsert(toppingsData, { onConflict: 'sede_id,topping_id' });

        if (toppingsInsertError) {
          console.error('❌ Error insertando sede_toppings:', toppingsInsertError);
        } else {
          console.log('✅ Toppings inicializados:', toppings.length);
        }
      }

      console.log('✅ Productos inicializados para sede exitosamente (agente)');
    } catch (error) {
      console.error('❌ Error en initializeSedeProductsForAgent:', error);
      throw new Error(`Error al inicializar productos para la sede: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Agregar topping a un plato existente
  async addToppingToPlato(platoId: number, toppingId: number): Promise<void> {
    try {
      console.log('🔗 Agregando topping a plato:', { platoId, toppingId });

      const { data, error } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .insert({
          plato_id: platoId,
          topping_id: toppingId
        })
        .select();

      if (error) {
        console.error('❌ Error agregando topping a plato:', error);
        throw error;
      }

      console.log('✅ Topping agregado al plato exitosamente:', data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en addToppingToPlato:', error);
      throw new Error(`Error al agregar topping al plato: ${msg}`);
    }
  }

  // Crear registro en sede_platos
  async createSedePlatoRecord(sedeId: string, platoId: number, price: number, available: boolean = true): Promise<void> {
    try {
      console.log('🏢 Creando registro sede_platos:', { sedeId, platoId, price, available });

      const { data, error } = await supabase
        .from('sede_platos')
        .insert({
          sede_id: sedeId,
          plato_id: platoId,
          available,
          price_override: price,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('❌ Error creando sede_platos:', error);
        throw error;
      }

      console.log('✅ Registro sede_platos creado exitosamente:', data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en createSedePlatoRecord:', error);
      throw new Error(`Error al crear registro sede_platos: ${msg}`);
    }
  }

  // Crear registro en sede_bebidas
  async createSedeBebidaRecord(sedeId: string, bebidaId: number, price: number, available: boolean = true): Promise<void> {
    try {
      console.log('🏢 Creando registro sede_bebidas:', { sedeId, bebidaId, price, available });

      const { data, error } = await supabase
        .from('sede_bebidas')
        .insert({
          sede_id: sedeId,
          bebida_id: bebidaId,
          available,
          price_override: price,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('❌ Error creando sede_bebidas:', error);
        throw error;
      }

      console.log('✅ Registro sede_bebidas creado exitosamente:', data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en createSedeBebidaRecord:', error);
      throw new Error(`Error al crear registro sede_bebidas: ${msg}`);
    }
  }

  // Crear registro en sede_toppings
  async createSedeToppingRecord(sedeId: string, toppingId: number, price: number, available: boolean = true): Promise<void> {
    try {
      console.log('🏢 Creando registro sede_toppings:', { sedeId, toppingId, price, available });

      const { data, error } = await supabase
        .from('sede_toppings')
        .insert({
          sede_id: sedeId,
          topping_id: toppingId,
          available,
          price_override: price,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('❌ Error creando sede_toppings:', error);
        throw error;
      }

      console.log('✅ Registro sede_toppings creado exitosamente:', data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en createSedeToppingRecord:', error);
      throw new Error(`Error al crear registro sede_toppings: ${msg}`);
    }
  }

  // Eliminar producto (plato, bebida o topping)
  async deleteProduct(productId: number, type: 'plato' | 'bebida' | 'topping'): Promise<void> {
    try {
      console.log('🗑️ Eliminando producto:', { productId, type });

      if (type === 'plato') {
        // Primero eliminar todas las relaciones con toppings
        await supabase
          .from(TABLES.PLATO_TOPPINGS)
          .delete()
          .eq('plato_id', productId);

        // Eliminar registros de sede_platos
        await supabase
          .from('sede_platos')
          .delete()
          .eq('plato_id', productId);

        // Eliminar el plato
        const { error } = await supabase
          .from(TABLES.PLATOS)
          .delete()
          .eq('id', productId);

        if (error) throw error;

      } else if (type === 'bebida') {
        // Eliminar registros de sede_bebidas
        await supabase
          .from('sede_bebidas')
          .delete()
          .eq('bebida_id', productId);

        // Eliminar la bebida
        const { error } = await supabase
          .from(TABLES.BEBIDAS)
          .delete()
          .eq('id', productId);

        if (error) throw error;

      } else if (type === 'topping') {
        // Primero eliminar todas las relaciones con platos
        await supabase
          .from(TABLES.PLATO_TOPPINGS)
          .delete()
          .eq('topping_id', productId);

        // Eliminar registros de sede_toppings
        await supabase
          .from('sede_toppings')
          .delete()
          .eq('topping_id', productId);

        // Eliminar el topping
        const { error } = await supabase
          .from(TABLES.TOPPINGS)
          .delete()
          .eq('id', productId);

        if (error) throw error;
      }

      console.log('✅ Producto eliminado exitosamente');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en deleteProduct:', error);
      throw new Error(`Error al eliminar producto: ${msg}`);
    }
  }

  // Eliminar relación topping-plato (solo la relación, no el topping)
  async removeToppingFromPlato(platoId: number, toppingId: number): Promise<void> {
    try {
      console.log('🗑️ Eliminando relación topping-plato:', { platoId, toppingId });

      const { error } = await supabase
        .from(TABLES.PLATO_TOPPINGS)
        .delete()
        .eq('plato_id', platoId)
        .eq('topping_id', toppingId);

      if (error) {
        console.error('❌ Error eliminando relación topping-plato:', error);
        throw error;
      }

      console.log('✅ Relación topping-plato eliminada exitosamente');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error completo en removeToppingFromPlato:', error);
      throw new Error(`Error al eliminar relación topping-plato: ${msg}`);
    }
  }
}

export const menuService = new MenuService();
