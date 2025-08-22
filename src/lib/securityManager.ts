/**
 * Security Manager for Production Deployment
 * Handles rate limiting, input validation, CORS policies, and security headers
 */

export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    blockDuration: number; // minutes
  };
  inputValidation: {
    enabled: boolean;
    maxStringLength: number;
    allowedFileTypes: string[];
    maxFileSize: number; // bytes
  };
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
  };
  headers: {
    enabled: boolean;
    csp: string;
    hsts: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
  };
}

export interface RateLimitInfo {
  requests: number;
  resetTime: number;
  blocked: boolean;
  blockExpiry: number;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private rateLimitStore: Map<string, RateLimitInfo> = new Map();
  private blockedIPs: Map<string, number> = new Map();
  private securityEvents: Array<{
    timestamp: number;
    type: string;
    details: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  private constructor() {
    this.config = {
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 100,
        maxRequestsPerHour: 1000,
        blockDuration: 15
      },
      inputValidation: {
        enabled: true,
        maxStringLength: 10000,
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        maxFileSize: 10 * 1024 * 1024 // 10MB
      },
      cors: {
        enabled: true,
        allowedOrigins: ['https://app.cotonai.com', 'https://localhost:5173'],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      },
      headers: {
        enabled: true,
        csp: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
        hsts: 'max-age=31536000; includeSubDomains',
        xFrameOptions: 'DENY',
        xContentTypeOptions: 'nosniff'
      }
    };
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  /**
   * Initialize security manager with custom configuration
   */
  initialize(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
    this.setupSecurityHeaders();
    this.startCleanupTimer();
    console.log('Security Manager initialized:', this.config);
  }

  /**
   * Check rate limiting for a client
   */
  checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetTime: number } {
    if (!this.config.rateLimiting.enabled) {
      return { allowed: true, remaining: -1, resetTime: -1 };
    }

    const now = Date.now();
    const minuteKey = `${clientId}:minute:${Math.floor(now / 60000)}`;
    const hourKey = `${clientId}:hour:${Math.floor(now / 3600000)}`;

    // Check if client is blocked
    if (this.blockedIPs.has(clientId)) {
      const blockExpiry = this.blockedIPs.get(clientId)!;
      if (now < blockExpiry) {
        this.logSecurityEvent('rate_limit_blocked', { clientId, blockExpiry }, 'medium');
        return { allowed: false, remaining: 0, resetTime: blockExpiry };
      } else {
        this.blockedIPs.delete(clientId);
      }
    }

    // Get current rate limit info
    const minuteInfo = this.rateLimitStore.get(minuteKey) || { requests: 0, resetTime: now + 60000 };
    const hourInfo = this.rateLimitStore.get(hourKey) || { requests: 0, resetTime: now + 3600000 };

    // Check limits
    if (minuteInfo.requests >= this.config.rateLimiting.maxRequestsPerMinute ||
        hourInfo.requests >= this.config.rateLimiting.maxRequestsPerHour) {
      
      // Block the client
      const blockExpiry = now + (this.config.rateLimiting.blockDuration * 60000);
      this.blockedIPs.set(clientId, blockExpiry);
      
      this.logSecurityEvent('rate_limit_exceeded', { 
        clientId, 
        minuteRequests: minuteInfo.requests,
        hourRequests: hourInfo.requests 
      }, 'high');
      
      return { allowed: false, remaining: 0, resetTime: blockExpiry };
    }

    // Update counters
    minuteInfo.requests++;
    hourInfo.requests++;
    this.rateLimitStore.set(minuteKey, minuteInfo);
    this.rateLimitStore.set(hourKey, hourInfo);

    const remaining = Math.min(
      this.config.rateLimiting.maxRequestsPerMinute - minuteInfo.requests,
      this.config.rateLimiting.maxRequestsPerHour - hourInfo.requests
    );

    return { 
      allowed: true, 
      remaining: Math.max(0, remaining), 
      resetTime: Math.min(minuteInfo.resetTime, hourInfo.resetTime) 
    };
  }

  /**
   * Validate input data
   */
  validateInput(data: any, type: 'string' | 'file' | 'json'): { valid: boolean; errors: string[] } {
    if (!this.config.inputValidation.enabled) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];

    switch (type) {
      case 'string':
        if (typeof data === 'string' && data.length > this.config.inputValidation.maxStringLength) {
          errors.push(`String length exceeds maximum of ${this.config.inputValidation.maxStringLength} characters`);
        }
        break;

      case 'file':
        if (data instanceof File) {
          if (!this.config.inputValidation.allowedFileTypes.includes(data.type)) {
            errors.push(`File type ${data.type} is not allowed`);
          }
          if (data.size > this.config.inputValidation.maxFileSize) {
            errors.push(`File size ${data.size} bytes exceeds maximum of ${this.config.inputValidation.maxFileSize} bytes`);
          }
        }
        break;

      case 'json':
        try {
          const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
          if (jsonString.length > this.config.inputValidation.maxStringLength) {
            errors.push(`JSON data length exceeds maximum of ${this.config.inputValidation.maxStringLength} characters`);
          }
        } catch (error) {
          errors.push('Invalid JSON data');
        }
        break;
    }

    if (errors.length > 0) {
      this.logSecurityEvent('input_validation_failed', { type, data, errors }, 'medium');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check CORS policy
   */
  checkCORS(origin: string, method: string, headers: string[]): { allowed: boolean; reason?: string } {
    if (!this.config.cors.enabled) {
      return { allowed: true };
    }

    // Check origin
    if (!this.config.cors.allowedOrigins.includes(origin)) {
      this.logSecurityEvent('cors_origin_blocked', { origin, allowedOrigins: this.config.cors.allowedOrigins }, 'medium');
      return { allowed: false, reason: 'Origin not allowed' };
    }

    // Check method
    if (!this.config.cors.allowedMethods.includes(method)) {
      this.logSecurityEvent('cors_method_blocked', { method, allowedMethods: this.config.cors.allowedMethods }, 'medium');
      return { allowed: false, reason: 'Method not allowed' };
    }

    // Check headers
    const invalidHeaders = headers.filter(header => !this.config.cors.allowedHeaders.includes(header));
    if (invalidHeaders.length > 0) {
      this.logSecurityEvent('cors_headers_blocked', { invalidHeaders, allowedHeaders: this.config.cors.allowedHeaders }, 'medium');
      return { allowed: false, reason: 'Headers not allowed' };
    }

    return { allowed: true };
  }

  /**
   * Setup security headers
   */
  private setupSecurityHeaders(): void {
    if (!this.config.headers.enabled) return;

    // Add security headers to document
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = this.config.headers.csp;
    document.head.appendChild(meta);

    // Add other security headers via meta tags
    const hstsMeta = document.createElement('meta');
    hstsMeta.httpEquiv = 'Strict-Transport-Security';
    hstsMeta.content = this.config.headers.hsts;
    document.head.appendChild(hstsMeta);

    const frameOptionsMeta = document.createElement('meta');
    frameOptionsMeta.httpEquiv = 'X-Frame-Options';
    frameOptionsMeta.content = this.config.headers.xFrameOptions;
    document.head.appendChild(frameOptionsMeta);

    const contentTypeMeta = document.createElement('meta');
    contentTypeMeta.httpEquiv = 'X-Content-Type-Options';
    contentTypeMeta.content = this.config.headers.xContentTypeOptions;
    document.head.appendChild(contentTypeMeta);
  }

  /**
   * Log security events
   */
  private logSecurityEvent(type: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const event = {
      timestamp: Date.now(),
      type,
      details,
      severity
    };

    this.securityEvents.push(event);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log critical events immediately
    if (severity === 'critical') {
      console.error('CRITICAL SECURITY EVENT:', event);
    } else if (severity === 'high') {
      console.warn('HIGH SECURITY EVENT:', event);
    } else {
      console.log('Security Event:', event);
    }
  }

  /**
   * Start cleanup timer for expired data
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean up expired rate limit data
      for (const [key, info] of this.rateLimitStore.entries()) {
        if (now > info.resetTime) {
          this.rateLimitStore.delete(key);
        }
      }

      // Clean up expired blocked IPs
      for (const [ip, expiry] of this.blockedIPs.entries()) {
        if (now > expiry) {
          this.blockedIPs.delete(ip);
        }
      }

      // Clean up old security events (older than 24 hours)
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      this.securityEvents = this.securityEvents.filter(event => event.timestamp > oneDayAgo);
    }, 60000); // Run every minute
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    blockedIPs: number;
    rateLimitStoreSize: number;
    recentEvents: Array<{ type: string; count: number; severity: string }>;
  } {
    const recentEvents = this.securityEvents
      .filter(event => event.timestamp > Date.now() - (60 * 60 * 1000)) // Last hour
      .reduce((acc, event) => {
        const key = `${event.type}:${event.severity}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const recentEventsArray = Object.entries(recentEvents).map(([key, count]) => {
      const [type, severity] = key.split(':');
      return { type, count, severity };
    });

    return {
      totalEvents: this.securityEvents.length,
      blockedIPs: this.blockedIPs.size,
      rateLimitStoreSize: this.rateLimitStore.size,
      recentEvents: recentEventsArray
    };
  }

  /**
   * Dispose security manager
   */
  dispose(): void {
    this.rateLimitStore.clear();
    this.blockedIPs.clear();
    this.securityEvents = [];
    console.log('Security Manager disposed');
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();
