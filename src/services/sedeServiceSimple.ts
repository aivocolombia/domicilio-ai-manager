import { supabase } from '@/lib/supabase';
import { logDebug, logError, logWarn } from '@/utils/logger';

export interface SedeInfo {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  created_at: string;
}

export interface SedeProduct {
  id: string;
  name: string;
  description?: string;
  pricing: number;
  is_available: boolean;
  toppings?: SedeTopping[];
}

export interface SedeTopping {
  id: string;
  name: string;
  description?: string;
  pricing: number;
  is_available: boolean;
}

export class SedeServiceSimple {
  private static instance: SedeServiceSimple;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static getInstance(): SedeServiceSimple {
    if (!SedeServiceSimple.instance) {
      SedeServiceSimple.instance = new SedeServiceSimple();
    }
    return SedeServiceSimple.instance;
  }

  private constructor() {
    // Limpiar caché cada 5 minutos
    setInterval(() => this.cleanExpiredCache(), 5 * 60 * 1000);
  }

  private cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logDebug('SedeServiceSimple', `🧹 Cache limpiado: ${cleaned} entradas`);
    }
  }

  private getCacheKey(operation: string, ...params: string[]): string {
    return `${operation}:${params.join(':')}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    logDebug('SedeServiceSimple', `✅ Cache hit: ${key}`);
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttl: number = 10 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    logDebug('SedeServiceSimple', `💾 Cached: ${key} (TTL: ${ttl/1000}s)`);
  }

  async getSedeById(sedeId: string, forceRefresh = false): Promise<SedeInfo | null> {
    const cacheKey = this.getCacheKey('sede-by-id', sedeId);
    
    if (!forceRefresh) {
      const cached = this.getFromCache<SedeInfo>(cacheKey);
      if (cached) return cached;
    }

    try {
      logDebug('SedeServiceSimple', `📡 Fetching sede ${sedeId} from database`);
      
      const { data, error } = await supabase
        .from('sedes')
        .select('id, name, address, is_active, created_at')
        .eq('id', sedeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No encontrada
        }
        throw error;
      }

      // Cache por 20 minutos
      this.setCache(cacheKey, data, 20 * 60 * 1000);
      
      logDebug('SedeServiceSimple', `✅ Loaded sede: ${data.name}`);
      return data;
    } catch (error) {
      logError('SedeServiceSimple', `Error loading sede ${sedeId}`, error);
      throw error;
    }
  }

  async getSedeProducts(sedeId: string, type: 'platos' | 'bebidas' | 'toppings', forceRefresh = false): Promise<SedeProduct[]> {
    const cacheKey = this.getCacheKey('sede-products', sedeId, type);
    
    if (!forceRefresh) {
      const cached = this.getFromCache<SedeProduct[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      logDebug('SedeServiceSimple', `📡 Fetching ${type} for sede ${sedeId}`);
      
      let query = supabase.from(`sede_${type}`);
      let products: SedeProduct[] = [];

      if (type === 'platos') {
        const { data, error } = await query
          .select(`
            plato_id,
            available,
            price_override,
            platos!inner(id, name, description, pricing)
          `)
          .eq('sede_id', sedeId);

        if (error) throw error;
        
        // Para cada plato, obtener sus toppings
        const platosWithToppings = [];
        for (const item of data || []) {
          // Obtener toppings del plato con disponibilidad de sede
          const { data: toppingsData } = await supabase
            .from('plato_toppings')
            .select(`
              topping_id,
              toppings!plato_toppings_topping_id_fkey(id, name, pricing)
            `)
            .eq('plato_id', item.platos.id);

          // Para cada topping, obtener la info de sede
          const toppingsWithSedeInfo = [];
          for (const toppingItem of toppingsData || []) {
            const { data: sedeData } = await supabase
              .from('sede_toppings')
              .select('available, price_override')
              .eq('topping_id', toppingItem.topping_id)
              .eq('sede_id', sedeId)
              .maybeSingle();

            toppingsWithSedeInfo.push({
              ...toppingItem,
              sede_info: sedeData
            });
          }

          const toppings = toppingsWithSedeInfo.map(toppingItem => ({
            id: toppingItem.toppings.id,
            name: toppingItem.toppings.name,
            description: '',
            pricing: toppingItem.sede_info?.price_override || toppingItem.toppings.pricing,
            is_available: toppingItem.sede_info?.available ?? true
          }));

          platosWithToppings.push({
            id: item.platos.id,
            name: item.platos.name,
            description: item.platos.description || '',
            pricing: item.price_override || item.platos.pricing,
            is_available: item.available,
            toppings: toppings
          });
        }
        
        products = platosWithToppings;
      } else if (type === 'bebidas') {
        const { data, error } = await query
          .select(`
            bebida_id,
            available,
            price_override,
            bebidas!inner(id, name, pricing)
          `)
          .eq('sede_id', sedeId);

        if (error) throw error;
        
        products = (data || []).map(item => ({
          id: item.bebidas.id,
          name: item.bebidas.name,
          description: '', // bebidas no tienen description
          pricing: item.price_override || item.bebidas.pricing,
          is_available: item.available
        }));
      } else { // toppings
        const { data, error } = await query
          .select(`
            topping_id,
            available,
            price_override,
            toppings!inner(id, name, pricing)
          `)
          .eq('sede_id', sedeId);

        if (error) throw error;
        
        products = (data || []).map(item => ({
          id: item.toppings.id,
          name: item.toppings.name,
          description: '', // toppings no tienen description
          pricing: item.price_override || item.toppings.pricing,
          is_available: item.available
        }));
      }
      
      // Cache por 10 minutos
      this.setCache(cacheKey, products, 10 * 60 * 1000);
      
      logDebug('SedeServiceSimple', `✅ Loaded ${products.length} ${type} for sede ${sedeId}`);
      return products;
    } catch (error) {
      logError('SedeServiceSimple', `Error loading ${type} for sede ${sedeId}`, error);
      throw error;
    }
  }

  // Método optimizado para obtener toda la info de una sede
  async getSedeCompleteInfo(sedeId: string, forceRefresh = false): Promise<{
    sede: SedeInfo | null;
    platos: SedeProduct[];
    bebidas: SedeProduct[];
    toppings: SedeProduct[]; // Mantenemos toppings para compatibilidad con StatusBar
  }> {
    const cacheKey = this.getCacheKey('sede-complete', sedeId);
    
    if (!forceRefresh) {
      const cached = this.getFromCache<any>(cacheKey);
      if (cached) return cached;
    }

    try {
      logDebug('SedeServiceSimple', `📡 Fetching complete info for sede ${sedeId}`);
      
      // Consultas paralelas para máximo rendimiento
      const [sedeResult, platosResult, bebidasResult, toppingsResult] = await Promise.all([
        this.getSedeById(sedeId, forceRefresh),
        this.getSedeProducts(sedeId, 'platos', forceRefresh),
        this.getSedeProducts(sedeId, 'bebidas', forceRefresh),
        this.getSedeProducts(sedeId, 'toppings', forceRefresh)
      ]);

      const completeInfo = {
        sede: sedeResult,
        platos: platosResult,
        bebidas: bebidasResult,
        toppings: toppingsResult
      };
      
      // Cache por 8 minutos
      this.setCache(cacheKey, completeInfo, 8 * 60 * 1000);
      
      logDebug('SedeServiceSimple', `✅ Complete sede info loaded for ${sedeId}`);
      return completeInfo;
    } catch (error) {
      logError('SedeServiceSimple', `Error loading complete info for sede ${sedeId}`, error);
      throw error;
    }
  }

  // Invalidar caché para una sede específica
  invalidateSedeCache(sedeId?: string): void {
    if (!sedeId) {
      // Limpiar todo el caché
      this.cache.clear();
      logDebug('SedeServiceSimple', '🧽 Cache completamente limpiado');
      return;
    }

    // Limpiar caché específico de una sede
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(sedeId)
    );

    keysToDelete.forEach(key => this.cache.delete(key));
    logDebug('SedeServiceSimple', `🔄 Cache invalidado para sede ${sedeId} (${keysToDelete.length} entradas)`);
  }

  // Pre-cargar datos críticos
  async preloadCriticalData(sedeId: string): Promise<void> {
    logDebug('SedeServiceSimple', `🚀 Pre-cargando datos críticos para sede ${sedeId}`);
    
    try {
      await this.getSedeById(sedeId);
      logDebug('SedeServiceSimple', '✅ Datos críticos pre-cargados');
    } catch (error) {
      logWarn('SedeServiceSimple', 'Error pre-cargando datos críticos', error);
    }
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton export
export const sedeServiceSimple = SedeServiceSimple.getInstance();
