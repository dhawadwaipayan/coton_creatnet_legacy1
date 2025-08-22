// Load Balancer for CotonAI Konva
// Handles multi-server deployment, intelligent routing, and failover

export interface ServerNode {
  id: string;
  url: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  load: number; // 0-100
  responseTime: number; // milliseconds
  lastCheck: number;
  region: string;
  priority: number; // 1-10, lower is higher priority
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'least_connections' | 'weighted' | 'geographic' | 'health_based';
  options?: any;
}

export interface HealthCheckResult {
  serverId: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
}

export class LoadBalancer {
  private static readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private static readonly HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
  private static readonly MAX_FAILURES = 3;
  private static readonly RECOVERY_TIME = 60000; // 1 minute
  
  // Server nodes
  private static servers: Map<string, ServerNode> = new Map();
  private static currentIndex = 0;
  
  // Health monitoring
  private static healthCheckTimer: NodeJS.Timeout | null = null;
  private static failureCounts: Map<string, number> = new Map();
  private static lastFailures: Map<string, number> = new Map();
  
  // Load balancing state
  private static activeConnections: Map<string, number> = new Map();
  private static userRegions: Map<string, string> = new Map();

  /**
   * Initialize load balancer
   */
  static initialize(servers: ServerNode[]): void {
    servers.forEach(server => {
      this.servers.set(server.id, server);
      this.activeConnections.set(server.id, 0);
      this.failureCounts.set(server.id, 0);
      this.lastFailures.set(server.id, 0);
    });
    
    this.startHealthChecks();
    console.log(`Load Balancer initialized with ${servers.length} servers`);
  }

  /**
   * Add server node
   */
  static addServer(server: ServerNode): void {
    this.servers.set(server.id, server);
    this.activeConnections.set(server.id, 0);
    this.failureCounts.set(server.id, 0);
    this.lastFailures.set(server.id, 0);
    console.log(`Server added: ${server.id} (${server.url})`);
  }

  /**
   * Remove server node
   */
  static removeServer(serverId: string): boolean {
    const removed = this.servers.delete(serverId);
    if (removed) {
      this.activeConnections.delete(serverId);
      this.failureCounts.delete(serverId);
      this.lastFailures.delete(serverId);
      console.log(`Server removed: ${serverId}`);
    }
    return removed;
  }

  /**
   * Get next server using specified strategy
   */
  static getNextServer(strategy: LoadBalancingStrategy = { type: 'health_based' }): ServerNode | null {
    const healthyServers = this.getHealthyServers();
    
    if (healthyServers.length === 0) {
      console.warn('No healthy servers available');
      return null;
    }
    
    switch (strategy.type) {
      case 'round_robin':
        return this.roundRobin(healthyServers);
      case 'least_connections':
        return this.leastConnections(healthyServers);
      case 'weighted':
        return this.weighted(healthyServers, strategy.options);
      case 'geographic':
        return this.geographic(healthyServers, strategy.options);
      case 'health_based':
      default:
        return this.healthBased(healthyServers);
    }
  }

  /**
   * Round-robin strategy
   */
  private static roundRobin(servers: ServerNode[]): ServerNode {
    this.currentIndex = (this.currentIndex + 1) % servers.length;
    return servers[this.currentIndex];
  }

  /**
   * Least connections strategy
   */
  private static leastConnections(servers: ServerNode[]): ServerNode {
    return servers.reduce((min, server) => {
      const minConnections = this.activeConnections.get(min.id) || 0;
      const serverConnections = this.activeConnections.get(server.id) || 0;
      return serverConnections < minConnections ? server : min;
    });
  }

  /**
   * Weighted strategy
   */
  private static weighted(servers: ServerNode[], options?: { weights?: Map<string, number> }): ServerNode {
    if (!options?.weights) {
      return this.healthBased(servers);
    }
    
    const weights = options.weights;
    const totalWeight = Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      const weight = weights.get(server.id) || 1;
      random -= weight;
      if (random <= 0) {
        return server;
      }
    }
    
    return servers[0]; // Fallback
  }

  /**
   * Geographic strategy
   */
  private static geographic(servers: ServerNode[], options?: { userRegion?: string }): ServerNode {
    const userRegion = options?.userRegion;
    
    if (!userRegion) {
      return this.healthBased(servers);
    }
    
    // Find servers in the same region
    const regionalServers = servers.filter(server => server.region === userRegion);
    
    if (regionalServers.length > 0) {
      return this.healthBased(regionalServers);
    }
    
    // Fallback to any healthy server
    return this.healthBased(servers);
  }

  /**
   * Health-based strategy
   */
  private static healthBased(servers: ServerNode[]): ServerNode {
    // Sort by health, load, and response time
    return servers.sort((a, b) => {
      // Health priority
      const healthOrder = { healthy: 0, degraded: 1, unhealthy: 2 };
      const healthDiff = healthOrder[a.health] - healthOrder[b.health];
      if (healthDiff !== 0) return healthDiff;
      
      // Load priority (lower is better)
      const loadDiff = a.load - b.load;
      if (loadDiff !== 0) return loadDiff;
      
      // Response time priority (lower is better)
      return a.responseTime - b.responseTime;
    })[0];
  }

  /**
   * Get healthy servers
   */
  private static getHealthyServers(): ServerNode[] {
    return Array.from(this.servers.values()).filter(server => 
      server.health !== 'unhealthy' && 
      this.failureCounts.get(server.id)! < this.MAX_FAILURES
    );
  }

  /**
   * Start health checks
   */
  private static startHealthChecks(): void {
    // Disabled for development - no real servers to check
    // this.healthCheckTimer = setInterval(() => {
    //   this.performHealthChecks();
    // }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health checks on all servers
   */
  private static async performHealthChecks(): Promise<void> {
    const healthChecks = Array.from(this.servers.keys()).map(serverId => 
      this.checkServerHealth(serverId)
    );
    
    const results = await Promise.allSettled(healthChecks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.updateServerHealth(result.value);
      } else {
        console.error('Health check failed:', result.reason);
      }
    });
  }

  /**
   * Check individual server health
   */
  private static async checkServerHealth(serverId: string): Promise<HealthCheckResult> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);
      
      const response = await fetch(`${server.url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      const healthy = response.ok;
      
      if (healthy) {
        this.resetFailureCount(serverId);
      } else {
        this.incrementFailureCount(serverId);
      }
      
      return {
        serverId,
        healthy,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.incrementFailureCount(serverId);
      
      return {
        serverId,
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update server health based on check result
   */
  private static updateServerHealth(result: HealthCheckResult): void {
    const server = this.servers.get(result.serverId);
    if (!server) return;
    
    // Update response time
    server.responseTime = result.responseTime;
    server.lastCheck = Date.now();
    
    // Update health status
    const failureCount = this.failureCounts.get(result.serverId) || 0;
    
    if (failureCount === 0) {
      server.health = 'healthy';
    } else if (failureCount < this.MAX_FAILURES) {
      server.health = 'degraded';
    } else {
      server.health = 'unhealthy';
    }
    
    // Update load (simplified - in real implementation, this would come from server metrics)
    if (result.healthy) {
      server.load = Math.max(0, server.load - 5);
    } else {
      server.load = Math.min(100, server.load + 10);
    }
  }

  /**
   * Increment failure count for server
   */
  private static incrementFailureCount(serverId: string): void {
    const currentCount = this.failureCounts.get(serverId) || 0;
    this.failureCounts.set(serverId, currentCount + 1);
    this.lastFailures.set(serverId, Date.now());
  }

  /**
   * Reset failure count for server
   */
  private static resetFailureCount(serverId: string): void {
    this.failureCounts.set(serverId, 0);
    this.lastFailures.set(serverId, 0);
  }

  /**
   * Check if server can recover
   */
  private static canRecover(serverId: string): boolean {
    const lastFailure = this.lastFailures.get(serverId) || 0;
    const failureCount = this.failureCounts.get(serverId) || 0;
    
    if (failureCount === 0) return true;
    
    const timeSinceLastFailure = Date.now() - lastFailure;
    return timeSinceLastFailure > this.RECOVERY_TIME;
  }

  /**
   * Attempt server recovery
   */
  private static attemptRecovery(serverId: string): void {
    if (this.canRecover(serverId)) {
      this.resetFailureCount(serverId);
      const server = this.servers.get(serverId);
      if (server) {
        server.health = 'degraded';
        console.log(`Server recovery attempted: ${serverId}`);
      }
    }
  }

  /**
   * Increment active connections for server
   */
  static incrementConnections(serverId: string): void {
    const current = this.activeConnections.get(serverId) || 0;
    this.activeConnections.set(serverId, current + 1);
  }

  /**
   * Decrement active connections for server
   */
  static decrementConnections(serverId: string): void {
    const current = this.activeConnections.get(serverId) || 0;
    this.activeConnections.set(serverId, Math.max(0, current - 1));
  }

  /**
   * Set user region for geographic routing
   */
  static setUserRegion(userId: string, region: string): void {
    this.userRegions.set(userId, region);
  }

  /**
   * Get user region
   */
  static getUserRegion(userId: string): string | undefined {
    return this.userRegions.get(userId);
  }

  /**
   * Get server statistics
   */
  static getServerStats(): Array<ServerNode & { activeConnections: number; failureCount: number }> {
    return Array.from(this.servers.values()).map(server => ({
      ...server,
      activeConnections: this.activeConnections.get(server.id) || 0,
      failureCount: this.failureCounts.get(server.id) || 0
    }));
  }

  /**
   * Get load balancer statistics
   */
  static getStats(): {
    totalServers: number;
    healthyServers: number;
    degradedServers: number;
    unhealthyServers: number;
    totalConnections: number;
    averageResponseTime: number;
  } {
    const servers = Array.from(this.servers.values());
    const totalConnections = Array.from(this.activeConnections.values()).reduce((sum, count) => sum + count, 0);
    const averageResponseTime = servers.reduce((sum, server) => sum + server.responseTime, 0) / servers.length;
    
    return {
      totalServers: servers.length,
      healthyServers: servers.filter(s => s.health === 'healthy').length,
      degradedServers: servers.filter(s => s.health === 'degraded').length,
      unhealthyServers: servers.filter(s => s.health === 'unhealthy').length,
      totalConnections,
      averageResponseTime: Math.round(averageResponseTime)
    };
  }

  /**
   * Force health check on specific server
   */
  static async forceHealthCheck(serverId: string): Promise<HealthCheckResult> {
    const result = await this.checkServerHealth(serverId);
    this.updateServerHealth(result);
    return result;
  }

  /**
   * Dispose load balancer
   */
  static dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    this.servers.clear();
    this.activeConnections.clear();
    this.failureCounts.clear();
    this.lastFailures.clear();
    this.userRegions.clear();
    
    console.log('Load Balancer disposed');
  }
}
