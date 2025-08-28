// Database Optimizer for CotonAI Konva
// Handles efficient Supabase queries, connection pooling, and query caching

export interface QueryCache {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
}

export interface BatchOperation {
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  id?: string;
}

export class DatabaseOptimizer {
  private static readonly CACHE_TTL = 300000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 100;
  private static readonly BATCH_SIZE = 50;
  private static readonly RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  // Query cache
  private static queryCache: Map<string, QueryCache> = new Map();
  
  // Connection pool
  private static connectionPool: any[] = [];
  private static maxConnections = 5;
  private static currentConnections = 0;

  /**
   * Initialize database optimizer
   */
  static initialize(): void {
    this.cleanupCache();
    console.log('Database Optimizer initialized');
  }

  /**
   * Get cached query result
   */
  static getCachedQuery(key: string): any | null {
    const cached = this.queryCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return cached.data;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.queryCache.delete(key);
    }
    
    return null;
  }

  /**
   * Cache query result
   */
  static cacheQuery(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    // Remove oldest entries if cache is full
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      this.removeOldestCacheEntries();
    }

    this.queryCache.set(key, {
      key,
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Remove oldest cache entries
   */
  private static removeOldestCacheEntries(): void {
    const entries = Array.from(this.queryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.ceil(entries.length * 0.2);
    entries.slice(0, toRemove).forEach(([key]) => {
      this.queryCache.delete(key);
    });
  }

  /**
   * Generate cache key from query parameters
   */
  static generateCacheKey(operation: string, params: any): string {
    const sortedParams = this.sortObjectKeys(params);
    return `${operation}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Sort object keys for consistent cache keys
   */
  private static sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObjectKeys(obj[key]);
    });

    return sorted;
  }

  /**
   * Execute query with caching
   */
  static async executeCachedQuery<T>(
    operation: string,
    params: any,
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cacheKey = this.generateCacheKey(operation, params);
    const cached = this.getCachedQuery(cacheKey);
    
    if (cached) {
      console.log(`Cache hit for: ${operation}`);
      return cached;
    }

    try {
      const result = await this.executeWithRetry(queryFn);
      this.cacheQuery(cacheKey, result, ttl);
      return result;
    } catch (error) {
      console.error(`Query execution failed: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Execute query with retry logic
   */
  private static async executeWithRetry<T>(
    queryFn: () => Promise<T>,
    attempts: number = this.RETRY_ATTEMPTS
  ): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      if (attempts > 1 && this.isRetryableError(error)) {
        console.log(`Retrying query, ${attempts - 1} attempts remaining`);
        await this.delay(this.RETRY_DELAY);
        return this.executeWithRetry(queryFn, attempts - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'rate limit exceeded',
      'too many requests'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(retryable => 
      errorMessage.includes(retryable.toLowerCase())
    );
  }

  /**
   * Execute batch operations efficiently
   */
  static async executeBatchOperations(operations: BatchOperation[]): Promise<any[]> {
    const results: any[] = [];
    const batches = this.chunkArray(operations, this.BATCH_SIZE);

    for (const batch of batches) {
      try {
        const batchResults = await Promise.all(
          batch.map(op => this.executeSingleOperation(op))
        );
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch operation failed:', error);
        // Continue with next batch
      }
    }

    return results;
  }

  /**
   * Execute single operation
   */
  private static async executeSingleOperation(operation: BatchOperation): Promise<any> {
    // This would integrate with your actual Supabase client
    // For now, return a mock result
    return {
      success: true,
      operation: operation.type,
      table: operation.table,
      id: operation.id || 'mock-id'
    };
  }

  /**
   * Chunk array into smaller batches
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Optimize image queries with pagination
   */
  static async getImagesWithPagination(
    boardId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ images: any[]; total: number; hasMore: boolean }> {
    const cacheKey = `images:${boardId}:${page}:${pageSize}`;
    
    return this.executeCachedQuery(
      'getImagesWithPagination',
      { boardId, page, pageSize },
      async () => {
        // Mock implementation - replace with actual Supabase query
        const offset = (page - 1) * pageSize;
        
        // Simulate database query
        const mockImages = Array.from({ length: pageSize }, (_, i) => ({
          id: `img-${offset + i}`,
          boardId,
          src: `mock-src-${offset + i}`,
                  x: Math.random() * 30000,
        y: Math.random() * 30000
        }));

        return {
          images: mockImages,
          total: 100, // Mock total
          hasMore: page * pageSize < 100
        };
      },
      60000 // 1 minute cache for image queries
    );
  }

  /**
   * Optimize board content queries
   */
  static async getBoardContentOptimized(
    boardId: string,
    includeImages: boolean = true,
    includeStrokes: boolean = true,
    includeTexts: boolean = true
  ): Promise<any> {
    const cacheKey = `board:${boardId}:${includeImages}:${includeStrokes}:${includeTexts}`;
    
    return this.executeCachedQuery(
      'getBoardContentOptimized',
      { boardId, includeImages, includeStrokes, includeTexts },
      async () => {
        // Mock implementation - replace with actual Supabase query
        const content: any = { id: boardId };
        
        if (includeImages) {
          content.images = await this.getImagesWithPagination(boardId, 1, 50);
        }
        
        if (includeStrokes) {
          content.strokes = []; // Mock strokes
        }
        
        if (includeTexts) {
          content.texts = []; // Mock texts
        }
        
        return content;
      },
      300000 // 5 minutes cache for board content
    );
  }

  /**
   * Clear specific cache entries
   */
  static clearCache(pattern?: string): void {
    if (pattern) {
      // Clear entries matching pattern
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.queryCache.clear();
    }
    
    console.log(`Cache cleared${pattern ? ` for pattern: ${pattern}` : ''}`);
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.queryCache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp,
      ttl: value.ttl
    }));

    return {
      size: this.queryCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 0, // Would need to track actual hits/misses
      entries
    };
  }

  /**
   * Cleanup expired cache entries
   */
  private static cleanupCache(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, value] of this.queryCache.entries()) {
      if ((now - value.timestamp) > value.ttl) {
        toRemove.push(key);
      }
    }

    toRemove.forEach(key => this.queryCache.delete(key));
    
    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} expired cache entries`);
    }
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose database optimizer
   */
  static dispose(): void {
    this.queryCache.clear();
    console.log('Database Optimizer disposed');
  }
}
