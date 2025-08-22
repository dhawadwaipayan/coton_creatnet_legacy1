// Advanced Cache System for CotonAI Konva
// Redis-like in-memory storage with persistence, TTL, and advanced features

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  memoryUsage: number;
}

export class AdvancedCache {
  private static readonly MAX_CACHE_SIZE = 1000;
  private static readonly MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100MB
  private static readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private static readonly PERSISTENCE_INTERVAL = 60000; // 1 minute
  
  // Cache storage
  private static cache: Map<string, CacheEntry> = new Map();
  private static tags: Map<string, Set<string>> = new Map();
  
  // Statistics
  private static hits = 0;
  private static misses = 0;
  private static evictions = 0;
  
  // Cleanup and persistence timers
  private static cleanupTimer: NodeJS.Timeout | null = null;
  private static persistenceTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize advanced cache
   */
  static initialize(): void {
    this.loadFromPersistence();
    this.startCleanupTimer();
    this.startPersistenceTimer();
    console.log('Advanced Cache initialized');
  }

  /**
   * Set cache entry with advanced options
   */
  static set<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      tags?: string[];
      size?: number;
    } = {}
  ): void {
    const { ttl = 300000, tags = [], size = this.estimateSize(value) } = options;
    
    // Check memory limits
    if (this.wouldExceedMemoryLimit(size)) {
      this.evictEntries(size);
    }
    
    // Remove old entry if exists
    this.remove(key);
    
    // Create new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      tags,
      size
    };
    
    this.cache.set(key, entry);
    
    // Update tag index
    this.updateTagIndex(key, tags);
    
    // Check cache size limits
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }
  }

  /**
   * Get cache entry with automatic TTL checking
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check TTL
    if (this.isExpired(entry)) {
      this.remove(key);
      this.misses++;
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;
    
    return entry.value;
  }

  /**
   * Get cache entry with metadata
   */
  static getWithMetadata<T>(key: string): { value: T; metadata: Omit<CacheEntry<T>, 'value'> } | null {
    const entry = this.cache.get(key);
    
    if (!entry || this.isExpired(entry)) {
      this.misses++;
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;
    
    const { value, ...metadata } = entry;
    return { value, metadata };
  }

  /**
   * Check if key exists and is not expired
   */
  static has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Remove cache entry
   */
  static remove(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Remove from tag index
    this.removeFromTagIndex(key, entry.tags);
    
    // Remove from cache
    this.cache.delete(key);
    
    return true;
  }

  /**
   * Remove entries by tag
   */
  static removeByTag(tag: string): number {
    const keys = this.getKeysByTag(tag);
    let removedCount = 0;
    
    keys.forEach(key => {
      if (this.remove(key)) {
        removedCount++;
      }
    });
    
    return removedCount;
  }

  /**
   * Get all keys for a specific tag
   */
  static getKeysByTag(tag: string): string[] {
    return Array.from(this.tags.get(tag) || []);
  }

  /**
   * Get cache statistics
   */
  static getStats(): CacheStats {
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.hits + this.misses;
    
    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      evictionCount: this.evictions,
      memoryUsage: totalSize / this.MAX_MEMORY_USAGE
    };
  }

  /**
   * Clear all cache entries
   */
  static clear(): void {
    this.cache.clear();
    this.tags.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    console.log('Advanced Cache cleared');
  }

  /**
   * Get cache entries by pattern
   */
  static getByPattern(pattern: string | RegExp): Array<{ key: string; value: any; metadata: any }> {
    const results: Array<{ key: string; value: any; metadata: any }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) continue;
      
      const matches = typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key);
      
      if (matches) {
        const { value, ...metadata } = entry;
        results.push({ key, value, metadata });
      }
    }
    
    return results;
  }

  /**
   * Set multiple cache entries efficiently
   */
  static mset(entries: Array<{ key: string; value: any; options?: any }>): void {
    entries.forEach(({ key, value, options }) => {
      this.set(key, value, options);
    });
  }

  /**
   * Get multiple cache entries efficiently
   */
  static mget<T>(keys: string[]): Array<T | null> {
    return keys.map(key => this.get<T>(key));
  }

  /**
   * Increment numeric value
   */
  static increment(key: string, amount: number = 1): number {
    const current = this.get<number>(key) || 0;
    const newValue = current + amount;
    this.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement numeric value
   */
  static decrement(key: string, amount: number = 1): number {
    return this.increment(key, -amount);
  }

  /**
   * Set expiration for existing key
   */
  static expire(key: string, ttl: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    entry.ttl = ttl;
    entry.timestamp = Date.now();
    return true;
  }

  /**
   * Get time to live for key
   */
  static ttl(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return -1;
    
    if (this.isExpired(entry)) return -2;
    
    const elapsed = Date.now() - entry.timestamp;
    return Math.max(0, entry.ttl - elapsed);
  }

  /**
   * Check if entry is expired
   */
  private static isExpired(entry: CacheEntry): boolean {
    return (Date.now() - entry.timestamp) > entry.ttl;
  }

  /**
   * Estimate size of value in bytes
   */
  private static estimateSize(value: any): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 1024; // Default size if estimation fails
    }
  }

  /**
   * Check if adding entry would exceed memory limit
   */
  private static wouldExceedMemoryLimit(entrySize: number): boolean {
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    return (currentSize + entrySize) > this.MAX_MEMORY_USAGE;
  }

  /**
   * Evict entries to make space
   */
  private static evictEntries(requiredSize: number): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by access count and last accessed (LRU + LFU hybrid)
    entries.sort((a, b) => {
      const scoreA = a[1].accessCount * 0.7 + (Date.now() - a[1].lastAccessed) * 0.3;
      const scoreB = b[1].accessCount * 0.7 + (Date.now() - b[1].lastAccessed) * 0.3;
      return scoreA - scoreB;
    });
    
    let freedSize = 0;
    const toRemove: string[] = [];
    
    for (const [key, entry] of entries) {
      if (freedSize >= requiredSize) break;
      
      toRemove.push(key);
      freedSize += entry.size;
    }
    
    toRemove.forEach(key => this.remove(key));
    this.evictions += toRemove.length;
  }

  /**
   * Evict oldest entries
   */
  private static evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, Math.ceil(entries.length * 0.1)); // Remove 10%
    toRemove.forEach(([key]) => this.remove(key));
    this.evictions += toRemove.length;
  }

  /**
   * Update tag index
   */
  private static updateTagIndex(key: string, tags: string[]): void {
    tags.forEach(tag => {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(key);
    });
  }

  /**
   * Remove from tag index
   */
  private static removeFromTagIndex(key: string, tags: string[]): void {
    tags.forEach(tag => {
      const tagSet = this.tags.get(tag);
      if (tagSet) {
        tagSet.delete(key);
        if (tagSet.size === 0) {
          this.tags.delete(tag);
        }
      }
    });
  }

  /**
   * Start cleanup timer
   */
  private static startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Start persistence timer
   */
  private static startPersistenceTimer(): void {
    this.persistenceTimer = setInterval(() => {
      this.persistToStorage();
    }, this.PERSISTENCE_INTERVAL);
  }

  /**
   * Cleanup expired entries
   */
  private static cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        toRemove.push(key);
      }
    }
    
    toRemove.forEach(key => this.remove(key));
    
    if (toRemove.length > 0) {
      console.log(`Advanced Cache: Cleaned up ${toRemove.length} expired entries`);
    }
  }

  /**
   * Persist cache to localStorage
   */
  private static persistToStorage(): void {
    try {
      const data = {
        cache: Array.from(this.cache.entries()),
        tags: Array.from(this.tags.entries()).map(([tag, keys]) => [tag, Array.from(keys)]),
        stats: { hits: this.hits, misses: this.misses, evictions: this.evictions },
        timestamp: Date.now()
      };
      
      localStorage.setItem('advanced-cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist cache:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private static loadFromPersistence(): void {
    try {
      const stored = localStorage.getItem('advanced-cache');
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      // Restore cache entries
      if (data.cache) {
        this.cache = new Map(data.cache);
      }
      
      // Restore tags
      if (data.tags) {
        this.tags = new Map(data.tags.map(([tag, keys]: [string, string[]]) => [tag, new Set(keys)]));
      }
      
      // Restore statistics
      if (data.stats) {
        this.hits = data.stats.hits || 0;
        this.misses = data.stats.misses || 0;
        this.evictions = data.stats.evictions || 0;
      }
      
      console.log('Advanced Cache: Restored from persistence');
    } catch (error) {
      console.warn('Failed to restore cache:', error);
    }
  }

  /**
   * Dispose advanced cache
   */
  static dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    
    this.persistToStorage();
    console.log('Advanced Cache disposed');
  }
}
