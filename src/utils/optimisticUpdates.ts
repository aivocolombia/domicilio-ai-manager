import { logger } from '@/utils/logger';

/**
 * Optimistic update utilities to avoid unnecessary refetching after CRUD operations
 */

export interface OptimisticUpdateOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: any, rollbackFn: () => void) => void;
  onFinally?: () => void;
}

/**
 * Performs an optimistic update on an array by adding an item
 */
export function optimisticAdd<T>(
  items: T[],
  newItem: T,
  operation: () => Promise<T>,
  options: OptimisticUpdateOptions<T> = {}
): {
  optimisticItems: T[];
  execute: () => Promise<T | null>;
} {
  // Immediately add the item optimistically
  const optimisticItems = [...items, newItem];
  
  const execute = async (): Promise<T | null> => {
    try {
      logger.info('Executing optimistic add operation');
      const result = await operation();
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (error) {
      logger.error('Optimistic add operation failed', { error });
      
      // Rollback function to remove the optimistically added item
      const rollback = () => {
        logger.info('Rolling back optimistic add');
        // The parent component should handle this by not including the newItem
      };
      
      if (options.onError) {
        options.onError(error, rollback);
      }
      
      return null;
    } finally {
      if (options.onFinally) {
        options.onFinally();
      }
    }
  };

  return { optimisticItems, execute };
}

/**
 * Performs an optimistic update on an array by updating an item
 */
export function optimisticUpdate<T extends { id: string | number }>(
  items: T[],
  itemId: string | number,
  updates: Partial<T>,
  operation: () => Promise<T>,
  options: OptimisticUpdateOptions<T> = {}
): {
  optimisticItems: T[];
  execute: () => Promise<T | null>;
} {
  // Store original item for rollback
  const originalIndex = items.findIndex(item => item.id === itemId);
  const originalItem = originalIndex >= 0 ? items[originalIndex] : null;
  
  // Apply optimistic update
  const optimisticItems = items.map(item => 
    item.id === itemId ? { ...item, ...updates } : item
  );
  
  const execute = async (): Promise<T | null> => {
    try {
      logger.info('Executing optimistic update operation', { itemId, updates });
      const result = await operation();
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (error) {
      logger.error('Optimistic update operation failed', { error, itemId });
      
      // Rollback function to restore original item
      const rollback = () => {
        logger.info('Rolling back optimistic update', { itemId });
        // The parent component should handle this by restoring the original item
      };
      
      if (options.onError) {
        options.onError(error, rollback);
      }
      
      return null;
    } finally {
      if (options.onFinally) {
        options.onFinally();
      }
    }
  };

  return { optimisticItems, execute };
}

/**
 * Performs an optimistic delete on an array by removing an item
 */
export function optimisticDelete<T extends { id: string | number }>(
  items: T[],
  itemId: string | number,
  operation: () => Promise<void>,
  options: OptimisticUpdateOptions<void> = {}
): {
  optimisticItems: T[];
  execute: () => Promise<boolean>;
} {
  // Store the item being deleted for potential rollback
  const itemToDelete = items.find(item => item.id === itemId);
  
  // Remove item optimistically
  const optimisticItems = items.filter(item => item.id !== itemId);
  
  const execute = async (): Promise<boolean> => {
    try {
      logger.info('Executing optimistic delete operation', { itemId });
      await operation();
      
      if (options.onSuccess) {
        options.onSuccess();
      }
      
      return true;
    } catch (error) {
      logger.error('Optimistic delete operation failed', { error, itemId });
      
      // Rollback function to restore deleted item
      const rollback = () => {
        logger.info('Rolling back optimistic delete', { itemId });
        // The parent component should handle this by restoring the deleted item
      };
      
      if (options.onError) {
        options.onError(error, rollback);
      }
      
      return false;
    } finally {
      if (options.onFinally) {
        options.onFinally();
      }
    }
  };

  return { optimisticItems, execute };
}

/**
 * Optimistic batch update utility
 */
export class OptimisticBatch<T extends { id: string | number }> {
  private operations: Array<() => Promise<any>> = [];
  private rollbackOperations: Array<() => void> = [];
  
  constructor(private items: T[]) {}

  add(newItem: T, operation: () => Promise<T>): OptimisticBatch<T> {
    this.operations.push(operation);
    this.items = [...this.items, newItem];
    
    // Add rollback
    this.rollbackOperations.push(() => {
      this.items = this.items.filter(item => item.id !== newItem.id);
    });
    
    return this;
  }

  update(itemId: string | number, updates: Partial<T>, operation: () => Promise<T>): OptimisticBatch<T> {
    const originalIndex = this.items.findIndex(item => item.id === itemId);
    const originalItem = originalIndex >= 0 ? { ...this.items[originalIndex] } : null;
    
    this.operations.push(operation);
    this.items = this.items.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    );
    
    // Add rollback
    this.rollbackOperations.push(() => {
      if (originalItem) {
        this.items = this.items.map(item => 
          item.id === itemId ? originalItem : item
        );
      }
    });
    
    return this;
  }

  delete(itemId: string | number, operation: () => Promise<void>): OptimisticBatch<T> {
    const itemToDelete = this.items.find(item => item.id === itemId);
    
    this.operations.push(operation);
    this.items = this.items.filter(item => item.id !== itemId);
    
    // Add rollback
    this.rollbackOperations.push(() => {
      if (itemToDelete) {
        this.items = [...this.items, itemToDelete];
      }
    });
    
    return this;
  }

  getOptimisticItems(): T[] {
    return this.items;
  }

  async execute(): Promise<{ success: boolean; results: any[]; errors: any[] }> {
    const results: any[] = [];
    const errors: any[] = [];
    
    try {
      logger.info('Executing optimistic batch operations', { count: this.operations.length });
      
      for (const operation of this.operations) {
        try {
          const result = await operation();
          results.push(result);
        } catch (error) {
          errors.push(error);
          logger.error('Batch operation failed', { error });
          
          // Rollback on first error
          this.rollback();
          break;
        }
      }
      
      const success = errors.length === 0;
      logger.info('Optimistic batch completed', { success, results: results.length, errors: errors.length });
      
      return { success, results, errors };
    } catch (error) {
      logger.error('Optimistic batch execution failed', { error });
      this.rollback();
      return { success: false, results, errors: [error] };
    }
  }

  private rollback(): void {
    logger.info('Rolling back optimistic batch operations');
    // Execute rollback operations in reverse order
    for (let i = this.rollbackOperations.length - 1; i >= 0; i--) {
      try {
        this.rollbackOperations[i]();
      } catch (error) {
        logger.error('Rollback operation failed', { error });
      }
    }
  }
}