// Memory Manager for CotonAI Konva Boards
// Handles object pooling, cleanup, and memory optimization

export interface PooledObject<T> {
  id: string;
  data: T;
  lastUsed: number;
  inUse: boolean;
}

export class MemoryManager {
  private static readonly MAX_POOL_SIZE = 100;
  private static readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private static readonly OBJECT_LIFETIME = 300000; // 5 minutes

  // Object pools for different types
  private static imagePool: Map<string, PooledObject<HTMLImageElement>> = new Map();
  private static canvasPool: Map<string, PooledObject<HTMLCanvasElement>> = new Map();
  private static contextPool: Map<string, PooledObject<CanvasRenderingContext2D>> = new Map();

  // Cleanup timer
  private static cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize memory manager
   */
  static initialize(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    console.log('Memory Manager initialized');
  }

  /**
   * Get an image from pool or create new one
   */
  static getImage(id: string): HTMLImageElement {
    const pooled = this.imagePool.get(id);
    
    if (pooled && !pooled.inUse) {
      pooled.inUse = true;
      pooled.lastUsed = Date.now();
      return pooled.data;
    }

    // Create new image
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    
    // Add to pool
    this.addToPool(this.imagePool, id, image);
    
    return image;
  }

  /**
   * Return an image to the pool
   */
  static returnImage(id: string): void {
    const pooled = this.imagePool.get(id);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
    }
  }

  /**
   * Get a canvas from pool or create new one
   */
  static getCanvas(id: string, width: number, height: number): HTMLCanvasElement {
    const pooled = this.canvasPool.get(id);
    
    if (pooled && !pooled.inUse) {
      const canvas = pooled.data;
      canvas.width = width;
      canvas.height = height;
      pooled.inUse = true;
      pooled.lastUsed = Date.now();
      return canvas;
    }

    // Create new canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    // Add to pool
    this.addToPool(this.canvasPool, id, canvas);
    
    return canvas;
  }

  /**
   * Return a canvas to the pool
   */
  static returnCanvas(id: string): void {
    const pooled = this.canvasPool.get(id);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
    }
  }

  /**
   * Get a context from pool or create new one
   */
  static getContext(canvas: HTMLCanvasElement, id: string): CanvasRenderingContext2D {
    const pooled = this.contextPool.get(id);
    
    if (pooled && !pooled.inUse) {
      pooled.inUse = true;
      pooled.lastUsed = Date.now();
      return pooled.data;
    }

    // Create new context
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    
    // Add to pool
    this.addToPool(this.contextPool, id, context);
    
    return context;
  }

  /**
   * Return a context to the pool
   */
  static returnContext(id: string): void {
    const pooled = this.contextPool.get(id);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
    }
  }

  /**
   * Add object to pool
   */
  private static addToPool<T>(
    pool: Map<string, PooledObject<T>>,
    id: string,
    data: T
  ): void {
    // Remove oldest objects if pool is full
    if (pool.size >= this.MAX_POOL_SIZE) {
      this.removeOldestFromPool(pool);
    }

    pool.set(id, {
      id,
      data,
      lastUsed: Date.now(),
      inUse: true
    });
  }

  /**
   * Remove oldest object from pool
   */
  private static removeOldestFromPool<T>(pool: Map<string, PooledObject<T>>): void {
    let oldestId: string | null = null;
    let oldestTime = Date.now();

    for (const [id, pooled] of pool.entries()) {
      if (pooled.lastUsed < oldestTime) {
        oldestTime = pooled.lastUsed;
        oldestId = id;
      }
    }

    if (oldestId) {
      pool.delete(oldestId);
    }
  }

  /**
   * Perform cleanup of old objects
   */
  private static performCleanup(): void {
    const now = Date.now();
    
    // Clean up old images
    this.cleanupPool(this.imagePool, now);
    
    // Clean up old canvases
    this.cleanupPool(this.canvasPool, now);
    
    // Clean up old contexts
    this.cleanupPool(this.contextPool, now);

    // Log memory usage
    this.logMemoryUsage();
  }

  /**
   * Clean up specific pool
   */
  private static cleanupPool<T>(pool: Map<string, PooledObject<T>>, now: number): void {
    const toRemove: string[] = [];

    for (const [id, pooled] of pool.entries()) {
      if (!pooled.inUse && (now - pooled.lastUsed) > this.OBJECT_LIFETIME) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => pool.delete(id));
  }

  /**
   * Log memory usage statistics
   */
  private static logMemoryUsage(): void {
    const totalObjects = this.imagePool.size + this.canvasPool.size + this.contextPool.size;
    const inUseObjects = Array.from(this.imagePool.values()).filter(p => p.inUse).length +
                        Array.from(this.canvasPool.values()).filter(p => p.inUse).length +
                        Array.from(this.contextPool.values()).filter(p => p.inUse).length;

    if (totalObjects > 0) {
      console.log(`Memory Manager: ${inUseObjects}/${totalObjects} objects in use`);
    }
  }

  /**
   * Force cleanup of all pools
   */
  static forceCleanup(): void {
    this.imagePool.clear();
    this.canvasPool.clear();
    this.contextPool.clear();
    console.log('Memory Manager: Forced cleanup completed');
  }

  /**
   * Get memory usage statistics
   */
  static getMemoryStats(): {
    totalObjects: number;
    inUseObjects: number;
    poolSizes: { images: number; canvases: number; contexts: number };
  } {
    const inUseImages = Array.from(this.imagePool.values()).filter(p => p.inUse).length;
    const inUseCanvases = Array.from(this.canvasPool.values()).filter(p => p.inUse).length;
    const inUseContexts = Array.from(this.contextPool.values()).filter(p => p.inUse).length;

    return {
      totalObjects: this.imagePool.size + this.canvasPool.size + this.contextPool.size,
      inUseObjects: inUseImages + inUseCanvases + inUseContexts,
      poolSizes: {
        images: this.imagePool.size,
        canvases: this.canvasPool.size,
        contexts: this.contextPool.size
      }
    };
  }

  /**
   * Dispose memory manager
   */
  static dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.forceCleanup();
    console.log('Memory Manager disposed');
  }
}
