// Real-time Collaboration Manager for CotonAI Konva
// Handles WebSocket connections, conflict resolution, and multi-user editing

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
  lastSeen: number;
  isActive: boolean;
}

export interface CollaborationEvent {
  type: 'cursor_move' | 'element_add' | 'element_update' | 'element_delete' | 'user_join' | 'user_leave';
  userId: string;
  timestamp: number;
  data: any;
  boardId: string;
}

export interface ConflictResolution {
  strategy: 'last_write_wins' | 'merge' | 'manual';
  resolved: boolean;
  data: any;
}

export class CollaborationManager {
  private static readonly RECONNECT_DELAY = 1000;
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private static readonly CURSOR_UPDATE_THROTTLE = 100; // 100ms
  
  // WebSocket connection
  private static socket: WebSocket | null = null;
  private static reconnectAttempts = 0;
  private static reconnectTimer: NodeJS.Timeout | null = null;
  
  // Collaboration state
  private static users: Map<string, CollaborationUser> = new Map();
  private static currentUser: CollaborationUser | null = null;
  private static boardId: string | null = null;
  private static isConnected = false;
  
  // Event handling
  private static eventHandlers: Map<string, Array<(event: CollaborationEvent) => void>> = new Map();
  private static pendingEvents: CollaborationEvent[] = [];
  
  // Performance optimization
  private static cursorUpdateThrottle: Map<string, NodeJS.Timeout> = new Map();
  private static heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize collaboration manager
   */
  static initialize(userId: string, userName: string, boardId: string): void {
    this.currentUser = {
      id: userId,
      name: userName,
      color: this.generateUserColor(),
      cursor: { x: 0, y: 0 },
      lastSeen: Date.now(),
      isActive: true
    };
    
    this.boardId = boardId;
    this.connect();
    this.startHeartbeat();
    console.log('Collaboration Manager initialized');
  }

  /**
   * Connect to WebSocket server
   */
  private static connect(): void {
    try {
      // Replace with your actual WebSocket server URL
      const wsUrl = `wss://your-websocket-server.com/collaboration?boardId=${this.boardId}&userId=${this.currentUser?.id}`;
      
      this.socket = new WebSocket(wsUrl);
      this.setupSocketHandlers();
      
    } catch (error) {
      console.error('Failed to connect to collaboration server:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private static setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('Collaboration WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.sendUserJoin();
      this.processPendingEvents();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleIncomingEvent(data);
      } catch (error) {
        console.error('Failed to parse collaboration event:', error);
      }
    };

    this.socket.onclose = () => {
      console.log('Collaboration WebSocket disconnected');
      this.isConnected = false;
      this.scheduleReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('Collaboration WebSocket error:', error);
      this.isConnected = false;
    };
  }

  /**
   * Send user join event
   */
  private static sendUserJoin(): void {
    if (!this.currentUser || !this.boardId) return;

    this.sendEvent({
      type: 'user_join',
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: {
        name: this.currentUser.name,
        color: this.currentUser.color
      },
      boardId: this.boardId
    });
  }

  /**
   * Handle incoming collaboration events
   */
  private static handleIncomingEvent(event: CollaborationEvent): void {
    switch (event.type) {
      case 'user_join':
        this.handleUserJoin(event);
        break;
      case 'user_leave':
        this.handleUserLeave(event);
        break;
      case 'cursor_move':
        this.handleCursorMove(event);
        break;
      case 'element_add':
        this.handleElementAdd(event);
        break;
      case 'element_update':
        this.handleElementUpdate(event);
        break;
      case 'element_delete':
        this.handleElementDelete(event);
        break;
      default:
        console.warn('Unknown collaboration event type:', event.type);
    }

    // Notify event handlers
    this.notifyEventHandlers(event);
  }

  /**
   * Handle user join event
   */
  private static handleUserJoin(event: CollaborationEvent): void {
    const user: CollaborationUser = {
      id: event.userId,
      name: event.data.name,
      color: event.data.color,
      cursor: { x: 0, y: 0 },
      lastSeen: Date.now(),
      isActive: true
    };

    this.users.set(event.userId, user);
    console.log(`User joined: ${user.name}`);
  }

  /**
   * Handle user leave event
   */
  private static handleUserLeave(event: CollaborationEvent): void {
    const user = this.users.get(event.userId);
    if (user) {
      user.isActive = false;
      user.lastSeen = Date.now();
      console.log(`User left: ${user.name}`);
    }
  }

  /**
   * Handle cursor move event
   */
  private static handleCursorMove(event: CollaborationEvent): void {
    const user = this.users.get(event.userId);
    if (user) {
      user.cursor = event.data.cursor;
      user.lastSeen = Date.now();
    }
  }

  /**
   * Handle element add event
   */
  private static handleElementAdd(event: CollaborationEvent): void {
    // Resolve conflicts if element with same ID exists
    const conflict = this.detectConflict(event);
    if (conflict) {
      const resolution = this.resolveConflict(conflict, event);
      if (resolution.resolved) {
        this.notifyElementHandlers('add', resolution.data);
      }
    } else {
      this.notifyElementHandlers('add', event.data);
    }
  }

  /**
   * Handle element update event
   */
  private static handleElementUpdate(event: CollaborationEvent): void {
    const conflict = this.detectConflict(event);
    if (conflict) {
      const resolution = this.resolveConflict(conflict, event);
      if (resolution.resolved) {
        this.notifyElementHandlers('update', resolution.data);
      }
    } else {
      this.notifyElementHandlers('update', event.data);
    }
  }

  /**
   * Handle element delete event
   */
  private static handleElementDelete(event: CollaborationEvent): void {
    this.notifyElementHandlers('delete', event.data);
  }

  /**
   * Detect conflicts between local and remote changes
   */
  private static detectConflict(event: CollaborationEvent): any | null {
    // Implement conflict detection logic
    // This would check if the element was modified locally since the last sync
    return null; // Simplified for now
  }

  /**
   * Resolve conflicts using specified strategy
   */
  private static resolveConflict(conflict: any, event: CollaborationEvent): ConflictResolution {
    // Default to last-write-wins strategy
    return {
      strategy: 'last_write_wins',
      resolved: true,
      data: event.data
    };
  }

  /**
   * Send collaboration event
   */
  static sendEvent(event: CollaborationEvent): void {
    if (this.isConnected && this.socket) {
      this.socket.send(JSON.stringify(event));
    } else {
      // Queue event for later sending
      this.pendingEvents.push(event);
    }
  }

  /**
   * Update user cursor position
   */
  static updateCursor(x: number, y: number): void {
    if (!this.currentUser || !this.boardId) return;

    // Throttle cursor updates for performance
    const userId = this.currentUser.id;
    if (this.cursorUpdateThrottle.has(userId)) {
      clearTimeout(this.cursorUpdateThrottle.get(userId)!);
    }

    this.cursorUpdateThrottle.set(userId, setTimeout(() => {
      this.currentUser!.cursor = { x, y };
      
      this.sendEvent({
        type: 'cursor_move',
        userId: this.currentUser!.id,
        timestamp: Date.now(),
        data: { cursor: { x, y } },
        boardId: this.boardId!
      });
    }, this.CURSOR_UPDATE_THROTTLE));
  }

  /**
   * Send element add event
   */
  static sendElementAdd(elementData: any): void {
    if (!this.currentUser || !this.boardId) return;

    this.sendEvent({
      type: 'element_add',
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: elementData,
      boardId: this.boardId
    });
  }

  /**
   * Send element update event
   */
  static sendElementUpdate(elementData: any): void {
    if (!this.currentUser || !this.boardId) return;

    this.sendEvent({
      type: 'element_update',
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: elementData,
      boardId: this.boardId
    });
  }

  /**
   * Send element delete event
   */
  static sendElementDelete(elementId: string): void {
    if (!this.currentUser || !this.boardId) return;

    this.sendEvent({
      type: 'element_delete',
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: { elementId },
      boardId: this.boardId
    });
  }

  /**
   * Register event handler
   */
  static on(eventType: string, handler: (event: CollaborationEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event handler
   */
  static off(eventType: string, handler: (event: CollaborationEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Notify event handlers
   */
  private static notifyEventHandlers(event: CollaborationEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in collaboration event handler:', error);
        }
      });
    }
  }

  /**
   * Notify element-specific handlers
   */
  private static notifyElementHandlers(action: string, data: any): void {
    const event: CollaborationEvent = {
      type: `element_${action}` as any,
      userId: 'system',
      timestamp: Date.now(),
      data,
      boardId: this.boardId || ''
    };

    this.notifyEventHandlers(event);
  }

  /**
   * Get active users
   */
  static getActiveUsers(): CollaborationUser[] {
    const now = Date.now();
    const activeUsers: CollaborationUser[] = [];
    
    for (const user of this.users.values()) {
      // Consider user active if seen in last 2 minutes
      if (user.isActive && (now - user.lastSeen) < 120000) {
        activeUsers.push(user);
      }
    }
    
    return activeUsers;
  }

  /**
   * Get current user
   */
  static getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }

  /**
   * Check if connected
   */
  static isConnectedToServer(): boolean {
    return this.isConnected;
  }

  /**
   * Process pending events
   */
  private static processPendingEvents(): void {
    while (this.pendingEvents.length > 0) {
      const event = this.pendingEvents.shift();
      if (event) {
        this.sendEvent(event);
      }
    }
  }

  /**
   * Schedule reconnection
   */
  private static scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
      this.connect();
    }, this.RECONNECT_DELAY * this.reconnectAttempts);
  }

  /**
   * Start heartbeat timer
   */
  private static startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.socket) {
        // Send heartbeat to keep connection alive
        this.socket.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Generate unique user color
   */
  private static generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Disconnect and cleanup
   */
  static disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Clear cursor update throttles
    this.cursorUpdateThrottle.forEach(timer => clearTimeout(timer));
    this.cursorUpdateThrottle.clear();

    this.isConnected = false;
    this.users.clear();
    this.currentUser = null;
    this.boardId = null;
    this.pendingEvents = [];
    this.eventHandlers.clear();

    console.log('Collaboration Manager disconnected');
  }

  /**
   * Dispose collaboration manager
   */
  static dispose(): void {
    this.disconnect();
    console.log('Collaboration Manager disposed');
  }
}
