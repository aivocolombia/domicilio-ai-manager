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
}

export class SedeService {
  private static instance: SedeService;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  private requireOverridePrice(value: number | null | undefined, context: string): number {
    if (value === null || value === undefined) {
      throw new Error(`Falta price_override obligatorio en ${context}`);
    }
    return value;
  }

  static getInstance(): SedeService {
    if (!SedeService.instance) {
      SedeService.instance = new SedeService();
    }
    return SedeService.instance;
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
      logDebug('SedeService', `🧹 Cache limpiado: ${cleaned} entradas`);
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

    logDebug('SedeService', `✅ Cache hit: ${key}`);
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttl: number = 10 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    logDebug('SedeService', `💾 Cached: ${key} (TTL: ${ttl/1000}s)`);
  }

  async getAllSedes(forceRefresh = false): Promise<SedeInfo[]> {
    const cacheKey = this.getCacheKey('all-sedes');
    
    if (!forceRefresh) {
      const cached = this.getFromCache<SedeInfo[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      logDebug('SedeService', '📡 Fetching all sedes from database');
      
      const { data, error } = await supabase
        .from('sedes')
        .select('id, name, address, is_active, created_at')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const sedes = data || [];
      
      // Cache por 15 minutos (datos que cambian poco)
      this.setCache(cacheKey, sedes, 15 * 60 * 1000);
      
      logDebug('SedeService', `✅ Loaded ${sedes.length} sedes`);
      return sedes;
    } catch (error) {
      logError('SedeService', 'Error loading sedes', error);
      throw error;
    }
  }

  async getSedeById(sedeId: string, forceRefresh = false): Promise<SedeInfo | null> {
    const cacheKey = this.getCacheKey('sede-by-id', sedeId);
    
    if (!forceRefresh) {
      const cached = this.getFromCache<SedeInfo>(cacheKey);
      if (cached) return cached;
    }

    try {
      logDebug('SedeService', `📡 Fetching sede ${sedeId} from database`);
      
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
      
      logDebug('SedeService', `✅ Loaded sede: ${data.name}`);
      return data;
    } catch (error) {
      logError('SedeService', `Error loading sede ${sedeId}`, error);
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
      logDebug('SedeService', `📡 Fetching ${type} for sede ${sedeId}`);
      
      const tableName = `sede_${type}`;
      const productTable = type; // platos, bebidas, toppings
      
      let selectQuery = '';
      
      if (type === 'platos') {
        selectQuery = `
          plato_id,
          available,
          price_override,
          platos!inner(
            id,
            name,
            description,
            pricing
          )
        `;
      } else if (type === 'bebidas') {
        selectQuery = `
          bebida_id,
          available,
          price_override,
          bebidas!inner(
            id,
            name,
            pricing
          )
        `;
      } else { // toppings
        selectQuery = `
          topping_id,
          available,
          price_override,
          toppings!inner(
            id,
            name,
            pricing
          )
        `;
      }

      const { data, error } = await supabase
        .from(tableName)
        .select(selectQuery)
        .eq('sede_id', sedeId)
        .eq('available', true);

      if (error) throw error;

      const products: SedeProduct[] = (data || []).map(item => {
        const product = item[productTable];
        const finalPrice = this.requireOverridePrice(
          item.price_override,
          `sede_${type} / sede=${sedeId} / producto=${product.id}`
        );
        
        return {
          id: product.id,
          name: product.name,
          description: product.description || '', // bebidas y toppings no tienen description
          pricing: finalPrice,
          is_available: item.available
        };
      });
      
      // Cache por 10 minutos
      this.setCache(cacheKey, products, 10 * 60 * 1000);
      
      logDebug('SedeService', `✅ Loaded ${products.length} ${type} for sede ${sedeId}`);
      return products;
    } catch (error) {
      logError('SedeService', `Error loading ${type} for sede ${sedeId}`, error);
      throw error;
    }
  }

  // Método optimizado para obtener toda la info de una sede de una vez
  async getSedeCompleteInfo(sedeId: string, forceRefresh = false): Promise<{
    sede: SedeInfo | null;
    platos: SedeProduct[];
    bebidas: SedeProduct[];
    toppings: SedeProduct[];
  }> {
    const cacheKey = this.getCacheKey('sede-complete', sedeId);
    
    if (!forceRefresh) {
      const cached = this.getFromCache<any>(cacheKey);
      if (cached) return cached;
    }

    try {
      logDebug('SedeService', `📡 Fetching complete info for sede ${sedeId}`);
      
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
      
      logDebug('SedeService', `✅ Complete sede info loaded for ${sedeId}`);
      return completeInfo;
    } catch (error) {
      logError('SedeService', `Error loading complete info for sede ${sedeId}`, error);
      throw error;
    }
  }

  // Invalidar caché para una sede específica
  invalidateSedeCache(sedeId?: string): void {
    if (!sedeId) {
      // Limpiar todo el caché
      this.cache.clear();
      logDebug('SedeService', '🧽 Cache completamente limpiado');
      return;
    }

    // Limpiar caché específico de una sede
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(sedeId)
    );

    keysToDelete.forEach(key => this.cache.delete(key));
    logDebug('SedeService', `🔄 Cache invalidado para sede ${sedeId} (${keysToDelete.length} entradas)`);
  }

  // Obtener estadísticas del caché
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // Pre-cargar datos críticos
  async preloadCriticalData(sedeId: string): Promise<void> {
    logDebug('SedeService', `🚀 Pre-cargando datos críticos para sede ${sedeId}`);
    
    try {
      await Promise.all([
        this.getSedeById(sedeId),
        this.getAllSedes()
      ]);
      
      logDebug('SedeService', '✅ Datos críticos pre-cargados');
    } catch (error) {
      logWarn('SedeService', 'Error pre-cargando datos críticos', error);
    }
  }
}

// Singleton export
export const sedeService = SedeService.getInstance();