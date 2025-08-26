import { logger } from '@/utils/logger';

export interface TimeoutOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  onRetry?: (attemptNumber: number, error: any) => void;
  onTimeout?: (timeoutMs: number) => void;
}

export interface WithTimeoutResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timedOut?: boolean;
  attempts: number;
}

/**
 * Wraps a promise with timeout, retry logic, and error recovery
 */
export async function withTimeout<T>(
  asyncFunction: () => Promise<T>,
  options: TimeoutOptions = {}
): Promise<WithTimeoutResult<T>> {
  const {
    timeoutMs = 12000, // 12 second default timeout
    retries = 2,
    retryDelayMs = 1000,
    onRetry,
    onTimeout
  } = options;

  let attempts = 0;
  let lastError: any = null;

  while (attempts <= retries) {
    attempts++;
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const timeoutError = new Error(`Operation timed out after ${timeoutMs}ms`);
          timeoutError.name = 'TimeoutError';
          reject(timeoutError);
        }, timeoutMs);
      });

      // Race between the actual function and timeout
      const result = await Promise.race([
        asyncFunction(),
        timeoutPromise
      ]);

      logger.info(`Operation completed successfully on attempt ${attempts}`);
      return {
        success: true,
        data: result,
        attempts
      };

    } catch (error: any) {
      lastError = error;
      const isTimeout = error.name === 'TimeoutError';
      
      logger.warn(`Attempt ${attempts} failed`, {
        error: error.message,
        isTimeout,
        retriesLeft: retries - attempts + 1
      });

      // Handle timeout
      if (isTimeout && onTimeout) {
        onTimeout(timeoutMs);
      }

      // If this was the last attempt, don't retry
      if (attempts > retries) {
        break;
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempts, error);
      }

      // Wait before retrying (except for the last attempt)
      if (attempts <= retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // All attempts failed
  const isTimeout = lastError?.name === 'TimeoutError';
  logger.error(`Operation failed after ${attempts} attempts`, {
    error: lastError?.message,
    isTimeout
  });

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    timedOut: isTimeout,
    attempts
  };
}

/**
 * Creates a sequential loader that processes items one by one with timeout protection
 */
export async function sequentialLoader<T, R>(
  items: T[],
  loader: (item: T) => Promise<R>,
  options: TimeoutOptions & { 
    onItemComplete?: (item: T, result: WithTimeoutResult<R>, index: number) => void;
    onItemStart?: (item: T, index: number) => void;
  } = {}
): Promise<{
  results: R[];
  errors: Array<{ item: T; error: string; index: number }>;
  totalAttempts: number;
}> {
  const results: R[] = [];
  const errors: Array<{ item: T; error: string; index: number }> = [];
  let totalAttempts = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (options.onItemStart) {
      options.onItemStart(item, i);
    }

    const result = await withTimeout(
      () => loader(item),
      options
    );

    totalAttempts += result.attempts;

    if (result.success && result.data !== undefined) {
      results.push(result.data);
    } else {
      errors.push({
        item,
        error: result.error || 'Unknown error',
        index: i
      });
    }

    if (options.onItemComplete) {
      options.onItemComplete(item, result, i);
    }
  }

  return { results, errors, totalAttempts };
}

/**
 * Debounced function executor with timeout protection
 */
export class DebouncedLoader<T> {
  private timeoutId: NodeJS.Timeout | null = null;
  private lastArgs: any[] = [];
  
  constructor(
    private loader: (...args: any[]) => Promise<T>,
    private delayMs: number = 300,
    private timeoutOptions: TimeoutOptions = {}
  ) {}

  execute(...args: any[]): Promise<WithTimeoutResult<T>> {
    this.lastArgs = args;

    return new Promise((resolve) => {
      // Clear existing timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      // Set new timeout
      this.timeoutId = setTimeout(async () => {
        const result = await withTimeout(
          () => this.loader(...this.lastArgs),
          this.timeoutOptions
        );
        resolve(result);
      }, this.delayMs);
    });
  }

  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Simple cache implementation with TTL
 */
export class SimpleCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  
  constructor(private ttlMs: number = 60000) {} // 1 minute default

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}