/**
 * Production Monitor for Real User Performance & System Health
 * Tracks Core Web Vitals, errors, and system performance in production
 */

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
}

export interface PerformanceMetrics {
  timestamp: number;
  url: string;
  userAgent: string;
  coreWebVitals: CoreWebVitals;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  };
  networkInfo: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
  errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface MonitoringConfig {
  enabled: boolean;
  sampleRate: number; // 0.0 to 1.0
  endpoint: string;
  batchSize: number;
  flushInterval: number; // milliseconds
  enableRealUserMonitoring: boolean;
  enableErrorTracking: boolean;
  enablePerformanceTracking: boolean;
}

export class ProductionMonitor {
  private static instance: ProductionMonitor;
  private config: MonitoringConfig;
  private metricsQueue: PerformanceMetrics[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private constructor() {
    this.config = {
      enabled: true,
      sampleRate: 0.1, // Sample 10% of users
      endpoint: 'https://analytics.cotonai.com/metrics',
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      enableRealUserMonitoring: true,
      enableErrorTracking: true,
      enablePerformanceTracking: true
    };
  }

  static getInstance(): ProductionMonitor {
    if (!ProductionMonitor.instance) {
      ProductionMonitor.instance = new ProductionMonitor();
    }
    return ProductionMonitor.instance;
  }

  /**
   * Initialize production monitor
   */
  initialize(config: Partial<MonitoringConfig> = {}): void {
    if (this.isInitialized) return;

    this.config = { ...this.config, ...config };
    
    if (!this.config.enabled) {
      console.log('Production Monitor disabled');
      return;
    }

    // Random sampling to reduce data volume
    if (Math.random() > this.config.sampleRate) {
      console.log('User not sampled for monitoring');
      return;
    }

    this.setupPerformanceObserver();
    this.setupErrorTracking();
    this.setupNetworkMonitoring();
    this.startFlushTimer();

    this.isInitialized = true;
    console.log('Production Monitor initialized with config:', this.config);
  }

  /**
   * Setup Performance Observer for Core Web Vitals
   */
  private setupPerformanceObserver(): void {
    if (!this.config.enablePerformanceTracking) return;

    try {
      // Observe Largest Contentful Paint
      if ('PerformanceObserver' in window) {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry;
          this.recordCoreWebVital('lcp', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Observe First Input Delay
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const firstEntry = entries[0] as PerformanceEntry;
          this.recordCoreWebVital('fid', firstEntry.processingStart - firstEntry.startTime);
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Observe Layout Shifts
        const clsObserver = new PerformanceObserver((entryList) => {
          let clsValue = 0;
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.recordCoreWebVital('cls', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Observe Navigation Timing
        const navigationObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const navigationEntry = entries[0] as PerformanceNavigationTiming;
          this.recordCoreWebVital('ttfb', navigationEntry.responseStart - navigationEntry.requestStart);
          this.recordCoreWebVital('fcp', navigationEntry.domContentLoadedEventEnd - navigationEntry.fetchStart);
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
      }
    } catch (error) {
      console.log('Performance Observer setup failed:', error);
    }
  }

  /**
   * Setup error tracking
   */
  private setupErrorTracking(): void {
    if (!this.config.enableErrorTracking) return;

    // Global error handler
    window.addEventListener('error', (event) => {
      this.recordError(event.error?.message || event.message, event.error?.stack, 'medium');
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError(event.reason?.message || 'Unhandled Promise Rejection', event.reason?.stack, 'high');
    });

    // Console error interceptor
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.recordError(args.join(' '), new Error().stack, 'medium');
      originalConsoleError.apply(console, args);
    };
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    if (!this.config.enablePerformanceTracking) return;

    // Monitor network information if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.recordNetworkInfo(connection);
        });
        this.recordNetworkInfo(connection);
      }
    }
  }

  /**
   * Record Core Web Vital metric
   */
  private recordCoreWebVital(metric: keyof CoreWebVitals, value: number): void {
    if (!this.isInitialized) return;

    const metrics = this.getCurrentMetrics();
    if (!metrics.coreWebVitals) {
      metrics.coreWebVitals = { lcp: 0, fid: 0, cls: 0, ttfb: 0, fcp: 0 };
    }

    metrics.coreWebVitals[metric] = value;
    this.updateCurrentMetrics(metrics);
  }

  /**
   * Record error
   */
  recordError(message: string, stack?: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    if (!this.isInitialized) return;

    const metrics = this.getCurrentMetrics();
    metrics.errors.push({
      message,
      stack,
      timestamp: Date.now(),
      severity
    });

    this.updateCurrentMetrics(metrics);
  }

  /**
   * Record network information
   */
  private recordNetworkInfo(connection: any): void {
    if (!this.isInitialized) return;

    const metrics = this.getCurrentMetrics();
    metrics.networkInfo = {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0
    };

    this.updateCurrentMetrics(metrics);
  }

  /**
   * Get current metrics object
   */
  private getCurrentMetrics(): PerformanceMetrics {
    if (this.metricsQueue.length === 0) {
      this.metricsQueue.push({
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        coreWebVitals: { lcp: 0, fid: 0, cls: 0, ttfb: 0, fcp: 0 },
        memoryUsage: this.getMemoryUsage(),
        networkInfo: { effectiveType: 'unknown', downlink: 0, rtt: 0 },
        errors: []
      });
    }

    return this.metricsQueue[this.metricsQueue.length - 1];
  }

  /**
   * Update current metrics
   */
  private updateCurrentMetrics(metrics: PerformanceMetrics): void {
    if (this.metricsQueue.length === 0) {
      this.metricsQueue.push(metrics);
    } else {
      this.metricsQueue[this.metricsQueue.length - 1] = metrics;
    }
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): { used: number; total: number; limit: number } {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }

    return { used: 0, total: 0, limit: 0 };
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);
  }

  /**
   * Flush metrics to analytics endpoint
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    try {
      const batch = this.metricsQueue.splice(0, this.config.batchSize);
      
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: batch,
          timestamp: Date.now(),
          sessionId: this.getSessionId()
        })
      });

      if (response.ok) {
        console.log(`Flushed ${batch.length} metrics to analytics`);
      } else {
        console.warn('Failed to flush metrics:', response.status);
        // Re-add failed metrics to queue
        this.metricsQueue.unshift(...batch);
      }
    } catch (error) {
      console.log('Error flushing metrics:', error);
      // Re-add failed metrics to queue
      this.metricsQueue.unshift(...this.metricsQueue.splice(0, this.config.batchSize));
    }
  }

  /**
   * Get or create session ID
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('cotonai_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('cotonai_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Manually flush metrics (useful for page unload)
   */
  async flushMetricsNow(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushMetrics();
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isEnabled: boolean;
    isInitialized: boolean;
    queueSize: number;
    sampleRate: number;
    totalMetricsCollected: number;
  } {
    return {
      isEnabled: this.config.enabled,
      isInitialized: this.isInitialized,
      queueSize: this.metricsQueue.length,
      sampleRate: this.config.sampleRate,
      totalMetricsCollected: this.metricsQueue.reduce((total, metrics) => total + metrics.errors.length, 0)
    };
  }

  /**
   * Dispose production monitor
   */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.flushMetricsNow().then(() => {
      this.metricsQueue = [];
      this.isInitialized = false;
      console.log('Production Monitor disposed');
    });
  }
}

// Export singleton instance
export const productionMonitor = ProductionMonitor.getInstance();
