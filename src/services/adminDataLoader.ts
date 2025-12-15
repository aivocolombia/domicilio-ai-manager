import { adminService, User, Sede, Repartidor } from '@/services/adminService';
import { metricsService, DashboardMetrics, MetricsFilters } from '@/services/metricsService';
import { withTimeout, sequentialLoader, DebouncedLoader, SimpleCache, TimeoutOptions, WithTimeoutResult } from '@/utils/timeoutUtils';
import { logger } from '@/utils/logger';

// Unified sede data interface
export interface UnifiedSedeData {
  simple: Array<{ id: string; name: string }>;
  complete: Sede[];
}

// Admin data interface
export interface AdminData {
  users: User[];
  sedes: UnifiedSedeData;
  repartidores: Repartidor[];
  metrics?: DashboardMetrics;
}

// Data loader options
export interface DataLoaderOptions extends TimeoutOptions {
  useCache?: boolean;
  cacheTtlMs?: number;
  sequential?: boolean;
}

export class AdminDataLoader {
  private sedesCache = new SimpleCache<UnifiedSedeData>(30000); // 30 seconds cache
  private usersCache = new SimpleCache<User[]>(20000); // 20 seconds cache  
  private repartidoresCache = new SimpleCache<Repartidor[]>(20000); // 20 seconds cache
  private metricsCache = new SimpleCache<DashboardMetrics>(10000); // 10 seconds cache
  
  private debouncedMetricsLoader: DebouncedLoader<DashboardMetrics>;

  constructor() {
    // Create debounced metrics loader with 500ms delay
    this.debouncedMetricsLoader = new DebouncedLoader(
      (filters: MetricsFilters) => metricsService.getDashboardMetrics(filters),
      500, // 500ms debounce
      {
        timeoutMs: 30000, // ✅ FIX: Aumentado de 15s a 30s para métricas complejas
        retries: 2, // ✅ FIX: Aumentado de 1 a 2 reintentos
        retryDelayMs: 2000,
        onTimeout: (timeoutMs) => logger.warn(`Metrics loading timed out after ${timeoutMs}ms`),
        onRetry: (attempt, error) => logger.warn(`Retrying metrics load attempt ${attempt}`, { error: error.message })
      }
    );
  }

  /**
   * Load users with timeout and caching
   */
  async loadUsers(options: DataLoaderOptions = {}): Promise<WithTimeoutResult<User[]>> {
    const cacheKey = 'admin-users';
    
    // Check cache first if enabled
    if (options.useCache !== false) {
      const cached = this.usersCache.get(cacheKey);
      if (cached) {
        logger.info('Returning cached users data');
        return { success: true, data: cached, attempts: 0 };
      }
    }

    const result = await withTimeout(
      () => adminService.getUsers(),
      {
        timeoutMs: 10000,
        retries: 2,
        retryDelayMs: 1500,
        onTimeout: (timeoutMs) => logger.warn(`Users loading timed out after ${timeoutMs}ms`),
        onRetry: (attempt, error) => logger.warn(`Retrying users load attempt ${attempt}`, { error: error.message }),
        ...options
      }
    );

    // Cache successful results
    if (result.success && result.data) {
      this.usersCache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Load unified sede data (both simple and complete) with consolidation and caching
   */
  async loadSedes(options: DataLoaderOptions = {}): Promise<WithTimeoutResult<UnifiedSedeData>> {
    const cacheKey = 'admin-sedes-unified';
    
    // Check cache first if enabled
    if (options.useCache !== false) {
      const cached = this.sedesCache.get(cacheKey);
      if (cached) {
        logger.info('Returning cached sedes data');
        return { success: true, data: cached, attempts: 0 };
      }
    }

    // Load complete sedes data and derive simple from it
    const result = await withTimeout(
      async () => {
        logger.info('Loading complete sedes data...');
        const complete = await adminService.getSedesComplete();
        
        // Derive simple data from complete data
        const simple = complete.map(sede => ({
          id: sede.id,
          name: sede.name
        }));

        const unifiedData: UnifiedSedeData = { simple, complete };
        logger.info(`Unified sedes loaded: ${simple.length} simple, ${complete.length} complete`);
        
        return unifiedData;
      },
      {
        timeoutMs: 12000,
        retries: 2,
        retryDelayMs: 2000,
        onTimeout: (timeoutMs) => logger.warn(`Sedes loading timed out after ${timeoutMs}ms`),
        onRetry: (attempt, error) => logger.warn(`Retrying sedes load attempt ${attempt}`, { error: error.message }),
        ...options
      }
    );

    // Cache successful results
    if (result.success && result.data) {
      this.sedesCache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Load repartidores with timeout and caching
   */
  async loadRepartidores(options: DataLoaderOptions = {}): Promise<WithTimeoutResult<Repartidor[]>> {
    const cacheKey = 'admin-repartidores';
    
    // Check cache first if enabled
    if (options.useCache !== false) {
      const cached = this.repartidoresCache.get(cacheKey);
      if (cached) {
        logger.info('Returning cached repartidores data');
        return { success: true, data: cached, attempts: 0 };
      }
    }

    const result = await withTimeout(
      () => adminService.getRepartidores(),
      {
        timeoutMs: 10000,
        retries: 2,
        retryDelayMs: 1500,
        onTimeout: (timeoutMs) => logger.warn(`Repartidores loading timed out after ${timeoutMs}ms`),
        onRetry: (attempt, error) => logger.warn(`Retrying repartidores load attempt ${attempt}`, { error: error.message }),
        ...options
      }
    );

    // Cache successful results
    if (result.success && result.data) {
      this.repartidoresCache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Load metrics with debouncing and caching
   */
  async loadMetrics(filters: MetricsFilters, options: DataLoaderOptions = {}): Promise<WithTimeoutResult<DashboardMetrics>> {
    const cacheKey = `metrics-${filters.fecha_inicio}-${filters.fecha_fin}-${filters.sede_id || 'all'}`;
    
    // Check cache first if enabled  
    if (options.useCache !== false) {
      const cached = this.metricsCache.get(cacheKey);
      if (cached) {
        logger.info('Returning cached metrics data');
        return { success: true, data: cached, attempts: 0 };
      }
    }

    // Use debounced loader
    const result = await this.debouncedMetricsLoader.execute(filters);

    // Cache successful results
    if (result.success && result.data) {
      this.metricsCache.set(cacheKey, result.data);
    }

    return result;
  }

  /**
   * Load all admin data sequentially to avoid overwhelming connections
   */
  async loadAllData(
    includeMetrics: boolean = false,
    metricsFilters?: MetricsFilters,
    options: DataLoaderOptions = {}
  ): Promise<{
    users: WithTimeoutResult<User[]>;
    sedes: WithTimeoutResult<UnifiedSedeData>;
    repartidores: WithTimeoutResult<Repartidor[]>;
    metrics?: WithTimeoutResult<DashboardMetrics>;
    totalAttempts: number;
  }> {
    logger.info('Starting sequential data loading for AdminPanel');
    
    const loaders = [
      { name: 'users', loader: () => this.loadUsers(options) },
      { name: 'sedes', loader: () => this.loadSedes(options) },
      { name: 'repartidores', loader: () => this.loadRepartidores(options) }
    ];

    if (includeMetrics && metricsFilters) {
      loaders.push({
        name: 'metrics',
        loader: () => this.loadMetrics(metricsFilters, options)
      });
    }

    if (options.sequential !== false) {
      // Sequential loading
      const results: any = {};
      let totalAttempts = 0;

      for (const { name, loader } of loaders) {
        logger.info(`Loading ${name}...`);
        const result = await loader();
        results[name] = result;
        totalAttempts += result.attempts;
        
        if (!result.success) {
          logger.error(`Failed to load ${name}: ${result.error}`);
        } else {
          logger.info(`Successfully loaded ${name}`);
        }
      }

      return { ...results, totalAttempts };
    } else {
      // Parallel loading (original behavior, not recommended)
      logger.warn('Using parallel loading - this may cause connection issues');
      const promises = loaders.map(({ loader }) => loader());
      const results = await Promise.all(promises);
      
      const totalAttempts = results.reduce((sum, result) => sum + result.attempts, 0);
      
      return {
        users: results[0],
        sedes: results[1], 
        repartidores: results[2],
        metrics: results[3],
        totalAttempts
      };
    }
  }

  /**
   * Invalidate specific cache entries
   */
  invalidateCache(sections?: Array<'users' | 'sedes' | 'repartidores' | 'metrics'>) {
    if (!sections) {
      // Clear all caches
      this.usersCache.clear();
      this.sedesCache.clear();
      this.repartidoresCache.clear();
      this.metricsCache.clear();
      logger.info('All caches cleared');
    } else {
      sections.forEach(section => {
        switch (section) {
          case 'users':
            this.usersCache.clear();
            break;
          case 'sedes':
            this.sedesCache.clear();
            break;
          case 'repartidores':
            this.repartidoresCache.clear();
            break;
          case 'metrics':
            this.metricsCache.clear();
            this.debouncedMetricsLoader.cancel();
            break;
        }
      });
      logger.info(`Caches cleared for: ${sections.join(', ')}`);
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      users: this.usersCache.has('admin-users'),
      sedes: this.sedesCache.has('admin-sedes-unified'),
      repartidores: this.repartidoresCache.has('admin-repartidores'),
      metrics: this.metricsCache.has('metrics-') // Partial key check
    };
  }
}

// Export singleton instance
export const adminDataLoader = new AdminDataLoader();