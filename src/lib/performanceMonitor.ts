// Performance Monitor for CotonAI Konva
// Tracks performance metrics and provides optimization insights

export interface PerformanceMetrics {
  boardLoadTime: number;
  imageLoadTime: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  averageFrameRate: number;
}

export interface PerformanceEvent {
  type: string;
  timestamp: number;
  duration: number;
  metadata?: any;
}

export class PerformanceMonitor {
  private static readonly MAX_EVENTS = 1000;
  private static readonly FRAME_RATE_SAMPLE_SIZE = 60;
  
  // Performance tracking
  private static events: PerformanceEvent[] = [];
  private static frameRates: number[] = [];
  private static lastFrameTime: number = 0;
  
  // Metrics
  private static boardLoadStartTime: number = 0;
  private static imageLoadStartTime: number = 0;
  private static renderStartTime: number = 0;

  /**
   * Initialize performance monitor
   */
  static initialize(): void {
    this.reset();
    this.startFrameRateMonitoring();
    console.log('Performance Monitor initialized');
  }

  /**
   * Start board loading timer
   */
  static startBoardLoad(): void {
    this.boardLoadStartTime = performance.now();
  }

  /**
   * End board loading timer
   */
  static endBoardLoad(): void {
    if (this.boardLoadStartTime > 0) {
      const duration = performance.now() - this.boardLoadStartTime;
      this.recordEvent('board-load', duration);
      this.boardLoadStartTime = 0;
    }
  }

  /**
   * Start image loading timer
   */
  static startImageLoad(): void {
    this.imageLoadStartTime = performance.now();
  }

  /**
   * End image loading timer
   */
  static endImageLoad(): void {
    if (this.imageLoadStartTime > 0) {
      const duration = performance.now() - this.imageLoadStartTime;
      this.recordEvent('image-load', duration);
      this.imageLoadStartTime = 0;
    }
  }

  /**
   * Start render timer
   */
  static startRender(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * End render timer
   */
  static endRender(): void {
    if (this.renderStartTime > 0) {
      const duration = performance.now() - this.renderStartTime;
      this.recordEvent('render', duration);
      this.renderStartTime = 0;
    }
  }

  /**
   * Record a performance event
   */
  static recordEvent(type: string, duration: number, metadata?: any): void {
    const event: PerformanceEvent = {
      type,
      timestamp: performance.now(),
      duration,
      metadata
    };

    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  /**
   * Start frame rate monitoring
   */
  private static startFrameRateMonitoring(): void {
    const measureFrameRate = () => {
      const now = performance.now();
      
      if (this.lastFrameTime > 0) {
        const frameTime = now - this.lastFrameTime;
        const frameRate = 1000 / frameTime;
        
        this.frameRates.push(frameRate);
        
        // Keep only recent frame rates
        if (this.frameRates.length > this.FRAME_RATE_SAMPLE_SIZE) {
          this.frameRates = this.frameRates.slice(-this.FRAME_RATE_SAMPLE_SIZE);
        }
      }
      
      this.lastFrameTime = now;
      requestAnimationFrame(measureFrameRate);
    };

    requestAnimationFrame(measureFrameRate);
  }

  /**
   * Get current performance metrics
   */
  static getMetrics(): PerformanceMetrics {
    const boardLoadEvents = this.events.filter(e => e.type === 'board-load');
    const imageLoadEvents = this.events.filter(e => e.type === 'image-load');
    const renderEvents = this.events.filter(e => e.type === 'render');

    const averageFrameRate = this.frameRates.length > 0 
      ? this.frameRates.reduce((a, b) => a + b, 0) / this.frameRates.length 
      : 0;

    return {
      boardLoadTime: this.calculateAverageTime(boardLoadEvents),
      imageLoadTime: this.calculateAverageTime(imageLoadEvents),
      renderTime: this.calculateAverageTime(renderEvents),
      memoryUsage: this.getMemoryUsage(),
      cacheHitRate: this.calculateCacheHitRate(),
      averageFrameRate
    };
  }

  /**
   * Calculate average time for events
   */
  private static calculateAverageTime(events: PerformanceEvent[]): number {
    if (events.length === 0) return 0;
    
    const totalTime = events.reduce((sum, event) => sum + event.duration, 0);
    return totalTime / events.length;
  }

  /**
   * Get current memory usage
   */
  private static getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }
    return 0;
  }

  /**
   * Calculate cache hit rate (mock implementation)
   */
  private static calculateCacheHitRate(): number {
    // This would integrate with actual cache statistics
    return 0.85; // Mock 85% hit rate
  }

  /**
   * Get performance insights and recommendations
   */
  static getInsights(): Array<{ type: 'info' | 'warning' | 'error'; message: string; suggestion?: string }> {
    const metrics = this.getMetrics();
    const insights: Array<{ type: 'info' | 'warning' | 'error'; message: string; suggestion?: string }> = [];

    // Board load time analysis
    if (metrics.boardLoadTime > 2000) {
      insights.push({
        type: 'warning',
        message: `Board loading is slow (${Math.round(metrics.boardLoadTime)}ms)`,
        suggestion: 'Consider using incremental loading for large boards'
      });
    } else if (metrics.boardLoadTime < 500) {
      insights.push({
        type: 'info',
        message: `Board loading is fast (${Math.round(metrics.boardLoadTime)}ms)`
      });
    }

    // Image load time analysis
    if (metrics.imageLoadTime > 1000) {
      insights.push({
        type: 'warning',
        message: `Image loading is slow (${Math.round(metrics.imageLoadTime)}ms)`,
        suggestion: 'Consider implementing image compression and lazy loading'
      });
    }

    // Frame rate analysis
    if (metrics.averageFrameRate < 30) {
      insights.push({
        type: 'error',
        message: `Low frame rate detected (${Math.round(metrics.averageFrameRate)}fps)`,
        suggestion: 'Reduce canvas complexity or optimize rendering'
      });
    } else if (metrics.averageFrameRate < 50) {
      insights.push({
        type: 'warning',
        message: `Frame rate could be improved (${Math.round(metrics.averageFrameRate)}fps)`,
        suggestion: 'Consider optimizing canvas operations'
      });
    }

    // Memory usage analysis
    if (metrics.memoryUsage > 0.8) {
      insights.push({
        type: 'error',
        message: `High memory usage (${Math.round(metrics.memoryUsage * 100)}%)`,
        suggestion: 'Implement object pooling and cleanup'
      });
    }

    return insights;
  }

  /**
   * Export performance data for analysis
   */
  static exportData(): string {
    const data = {
      metrics: this.getMetrics(),
      insights: this.getInsights(),
      events: this.events.slice(-100), // Last 100 events
      frameRates: this.frameRates,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Reset performance monitor
   */
  static reset(): void {
    this.events = [];
    this.frameRates = [];
    this.lastFrameTime = 0;
    this.boardLoadStartTime = 0;
    this.imageLoadStartTime = 0;
    this.renderStartTime = 0;
  }

  /**
   * Log performance summary
   */
  static logSummary(): void {
    const metrics = this.getMetrics();
    const insights = this.getInsights();

    console.group('🎯 Performance Summary');
    console.log(`Board Load Time: ${Math.round(metrics.boardLoadTime)}ms`);
    console.log(`Image Load Time: ${Math.round(metrics.imageLoadTime)}ms`);
    console.log(`Render Time: ${Math.round(metrics.renderTime)}ms`);
    console.log(`Memory Usage: ${Math.round(metrics.memoryUsage * 100)}%`);
    console.log(`Cache Hit Rate: ${Math.round(metrics.cacheHitRate * 100)}%`);
    console.log(`Average Frame Rate: ${Math.round(metrics.averageFrameRate)}fps`);
    
    if (insights.length > 0) {
      console.group('💡 Insights & Recommendations');
      insights.forEach(insight => {
        const icon = insight.type === 'error' ? '❌' : insight.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${insight.message}`);
        if (insight.suggestion) {
          console.log(`   💡 ${insight.suggestion}`);
        }
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Dispose performance monitor
   */
  static dispose(): void {
    this.reset();
    console.log('Performance Monitor disposed');
  }
}
