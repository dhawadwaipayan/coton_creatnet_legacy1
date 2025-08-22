/**
 * CDN Manager for Global Content Delivery
 * Handles image optimization, edge caching, and geographic distribution
 */

export interface CDNConfig {
  baseUrl: string;
  regions: string[];
  imageOptimization: {
    quality: number;
    format: 'webp' | 'avif' | 'auto';
    maxWidth: number;
    maxHeight: number;
  };
  cacheStrategy: 'aggressive' | 'balanced' | 'minimal';
}

export interface CDNImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  gravity?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export class CDNManager {
  private static instance: CDNManager;
  private config: CDNConfig;
  private imageCache: Map<string, string> = new Map();
  private regionLatency: Map<string, number> = new Map();

  private constructor() {
    this.config = {
      baseUrl: 'https://cdn.cotonai.com',
      regions: ['us-east', 'us-west', 'eu-west', 'asia-east'],
      imageOptimization: {
        quality: 85,
        format: 'auto',
        maxWidth: 2048,
        maxHeight: 2048
      },
      cacheStrategy: 'balanced'
    };
  }

  static getInstance(): CDNManager {
    if (!CDNManager.instance) {
      CDNManager.instance = new CDNManager();
    }
    return CDNManager.instance;
  }

  /**
   * Initialize CDN with custom configuration
   */
  initialize(config: Partial<CDNConfig>): void {
    this.config = { ...this.config, ...config };
    this.detectOptimalRegion();
    console.log('CDN Manager initialized:', this.config);
  }

  /**
   * Detect optimal CDN region based on user location
   */
  private async detectOptimalRegion(): Promise<void> {
    try {
      // Use a lightweight service to detect user region
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      const userRegion = this.mapRegion(data.region_code);
      if (userRegion) {
        this.config.baseUrl = `https://${userRegion}.cdn.cotonai.com`;
        console.log('Optimal CDN region detected:', userRegion);
      }
    } catch (error) {
      console.log('CDN region detection failed, using default:', error);
    }
  }

  /**
   * Map country codes to CDN regions
   */
  private mapRegion(countryCode: string): string | null {
    const regionMap: Record<string, string> = {
      'US': 'us-east',
      'CA': 'us-east',
      'GB': 'eu-west',
      'DE': 'eu-west',
      'FR': 'eu-west',
      'JP': 'asia-east',
      'KR': 'asia-east',
      'CN': 'asia-east'
    };
    return regionMap[countryCode] || null;
  }

  /**
   * Get optimized image URL with CDN parameters
   */
  getOptimizedImageUrl(
    originalUrl: string,
    options: CDNImageOptions = {}
  ): string {
    // If it's already a CDN URL, return as is
    if (originalUrl.includes('cdn.cotonai.com')) {
      return originalUrl;
    }

    // Generate cache key for this image configuration
    const cacheKey = this.generateCacheKey(originalUrl, options);
    
    // Check if we have a cached optimized URL
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    // Build CDN URL with optimization parameters
    const cdnUrl = this.buildCDNUrl(originalUrl, options);
    
    // Cache the optimized URL
    this.imageCache.set(cacheKey, cdnUrl);
    
    return cdnUrl;
  }

  /**
   * Generate cache key for image options
   */
  private generateCacheKey(originalUrl: string, options: CDNImageOptions): string {
    const params = new URLSearchParams();
    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', options.quality.toString());
    if (options.format) params.append('f', options.format);
    if (options.fit) params.append('fit', options.fit);
    if (options.gravity) params.append('g', options.gravity);
    
    return `${originalUrl}?${params.toString()}`;
  }

  /**
   * Build CDN URL with optimization parameters
   */
  private buildCDNUrl(originalUrl: string, options: CDNImageOptions): string {
    const url = new URL(this.config.baseUrl);
    
    // Add image optimization parameters
    if (options.width) url.searchParams.append('w', options.width.toString());
    if (options.height) url.searchParams.append('h', options.height.toString());
    if (options.quality) url.searchParams.append('q', options.quality.toString());
    if (options.format) url.searchParams.append('f', options.format);
    if (options.fit) url.searchParams.append('fit', options.fit);
    if (options.gravity) url.searchParams.append('g', options.gravity);
    
    // Add original image URL
    url.searchParams.append('url', encodeURIComponent(originalUrl));
    
    return url.toString();
  }

  /**
   * Preload critical images for better performance
   */
  async preloadImages(imageUrls: string[]): Promise<void> {
    const preloadPromises = imageUrls.map(async (url) => {
      try {
        const optimizedUrl = this.getOptimizedImageUrl(url, {
          quality: 50, // Lower quality for preloading
          format: 'webp'
        });
        
        // Create a hidden image element to preload
        const img = new Image();
        img.src = optimizedUrl;
        
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Don't fail on preload errors
        });
      } catch (error) {
        console.log('Image preload failed:', url, error);
      }
    });

    await Promise.allSettled(preloadPromises);
    console.log('Image preloading completed');
  }

  /**
   * Get CDN performance metrics
   */
  getPerformanceMetrics(): {
    cacheHitRate: number;
    averageLatency: number;
    regions: Record<string, number>;
  } {
    const totalRequests = this.imageCache.size;
    const cacheHits = this.imageCache.size; // All requests are cached
    
    return {
      cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
      averageLatency: this.calculateAverageLatency(),
      regions: Object.fromEntries(this.regionLatency)
    };
  }

  /**
   * Calculate average latency across regions
   */
  private calculateAverageLatency(): number {
    if (this.regionLatency.size === 0) return 0;
    
    const totalLatency = Array.from(this.regionLatency.values()).reduce(
      (sum, latency) => sum + latency, 0
    );
    
    return totalLatency / this.regionLatency.size;
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    console.log('CDN image cache cleared');
  }

  /**
   * Dispose CDN manager
   */
  dispose(): void {
    this.clearCache();
    this.regionLatency.clear();
    console.log('CDN Manager disposed');
  }
}

// Export singleton instance
export const cdnManager = CDNManager.getInstance();
