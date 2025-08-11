import { supabase } from './supabase'
import { PlatoFuerte, Topping, Bebida, PlatoFuerteConToppings, InventoryItem } from '@/types/delivery'

// Servicio para platos fuertes
export const platosFuertesService = {
  // Obtener todos los platos fuertes
  async getAll(): Promise<PlatoFuerte[]> {
    const { data, error } = await supabase
      .from('platos_fuertes')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data || []
  },

  // Obtener platos fuertes con sus toppings
  async getAllWithToppings(): Promise<PlatoFuerteConToppings[]> {
    const { data, error } = await supabase
      .from('platos_fuertes')
      .select(`
        *,
        plato_topping!inner(
          is_default,
          toppings(*)
        )
      `)
      .order('name')
    
    if (error) throw error
    
    // Transformar los datos para que sean más fáciles de usar
    return (data || []).map(plato => ({
      ...plato,
      toppings: plato.plato_topping?.map(pt => pt.toppings).filter(Boolean) || [],
      default_toppings: plato.plato_topping?.filter(pt => pt.is_default).map(pt => pt.toppings).filter(Boolean) || []
    }))
  },

  // Actualizar disponibilidad
  async updateAvailability(id: string, isAvailable: boolean): Promise<void> {
    const { error } = await supabase
      .from('platos_fuertes')
      .update({ is_available: isAvailable })
      .eq('id', id)
    
    if (error) throw error
  },

  // Crear nuevo plato fuerte
  async create(plato: Omit<PlatoFuerte, 'id' | 'created_at' | 'updated_at'>): Promise<PlatoFuerte> {
    const { data, error } = await supabase
      .from('platos_fuertes')
      .insert(plato)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Actualizar plato fuerte
  async update(id: string, updates: Partial<PlatoFuerte>): Promise<PlatoFuerte> {
    const { data, error } = await supabase
      .from('platos_fuertes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Eliminar plato fuerte
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('platos_fuertes')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicio para toppings
export const toppingsService = {
  // Obtener todos los toppings
  async getAll(): Promise<Topping[]> {
    const { data, error } = await supabase
      .from('toppings')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data || []
  },

  // Actualizar disponibilidad
  async updateAvailability(id: string, isAvailable: boolean): Promise<void> {
    const { error } = await supabase
      .from('toppings')
      .update({ is_available: isAvailable })
      .eq('id', id)
    
    if (error) throw error
  },

  // Crear nuevo topping
  async create(topping: Omit<Topping, 'id' | 'created_at' | 'updated_at'>): Promise<Topping> {
    const { data, error } = await supabase
      .from('toppings')
      .insert(topping)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Actualizar topping
  async update(id: string, updates: Partial<Topping>): Promise<Topping> {
    const { data, error } = await supabase
      .from('toppings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Eliminar topping
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('toppings')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicio para bebidas
export const bebidasService = {
  // Obtener todas las bebidas
  async getAll(): Promise<Bebida[]> {
    const { data, error } = await supabase
      .from('bebidas')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data || []
  },

  // Actualizar disponibilidad
  async updateAvailability(id: string, isAvailable: boolean): Promise<void> {
    const { error } = await supabase
      .from('bebidas')
      .update({ is_available: isAvailable })
      .eq('id', id)
    
    if (error) throw error
  },

  // Crear nueva bebida
  async create(bebida: Omit<Bebida, 'id' | 'created_at' | 'updated_at'>): Promise<Bebida> {
    const { data, error } = await supabase
      .from('bebidas')
      .insert(bebida)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Actualizar bebida
  async update(id: string, updates: Partial<Bebida>): Promise<Bebida> {
    const { data, error } = await supabase
      .from('bebidas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Eliminar bebida
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bebidas')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Servicio para relaciones plato-topping
export const platoToppingService = {
  // Agregar topping a un plato
  async addTopping(platoId: string, toppingId: string, isDefault: boolean = false): Promise<void> {
    const { error } = await supabase
      .from('plato_topping')
      .insert({
        plato_fuerte_id: platoId,
        topping_id: toppingId,
        is_default: isDefault
      })
    
    if (error) throw error
  },

  // Remover topping de un plato
  async removeTopping(platoId: string, toppingId: string): Promise<void> {
    const { error } = await supabase
      .from('plato_topping')
      .delete()
      .eq('plato_fuerte_id', platoId)
      .eq('topping_id', toppingId)
    
    if (error) throw error
  },

  // Obtener toppings de un plato
  async getToppingsForPlato(platoId: string): Promise<Topping[]> {
    const { data, error } = await supabase
      .from('plato_topping')
      .select(`
        toppings(*)
      `)
      .eq('plato_fuerte_id', platoId)
    
    if (error) throw error
    return data?.map(pt => pt.toppings).filter(Boolean) || []
  }
}

// Función helper para convertir productos de la BD al formato del inventario
export const convertToInventoryItem = (
  item: PlatoFuerte | Topping | Bebida,
  category: 'plato_fuerte' | 'topping' | 'bebida'
): InventoryItem => {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    price: item.price,
    isAvailable: item.is_available,
    category,
    imageUrl: item.image_url || undefined,
    preparationTime: 'preparation_time' in item ? item.preparation_time : undefined,
    size: 'size' in item ? item.size : undefined
  }
} 