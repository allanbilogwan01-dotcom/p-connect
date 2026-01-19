/**
 * LAN Server API Client
 * Handles communication with local network backend server
 * Falls back to localStorage when server is unavailable
 */

export interface LANServerConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface SyncStatus {
  lastSync: string | null;
  pendingChanges: number;
  isOnline: boolean;
  serverVersion: string | null;
}

const DEFAULT_CONFIG: LANServerConfig = {
  baseUrl: 'http://localhost:3001/api',
  timeout: 5000,
  retryAttempts: 3,
};

class LANServerClient {
  private config: LANServerConfig;
  private isOnline: boolean = false;
  private lastSync: string | null = null;
  private pendingQueue: PendingOperation[] = [];

  constructor(config: Partial<LANServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadPendingQueue();
    this.checkServerStatus();
  }

  // Check if LAN server is available
  async checkServerStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${this.config.baseUrl}/health`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isOnline = response.ok;
      
      if (response.ok) {
        const data = await response.json();
        console.log('[LAN] Server connected:', data.version);
      }
      
      return this.isOnline;
    } catch {
      this.isOnline = false;
      console.log('[LAN] Server offline - using local storage');
      return false;
    }
  }

  // Generic fetch with timeout and retry
  private async fetchWithRetry<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.warn(`[LAN] Attempt ${attempt + 1} failed:`, error);
        if (attempt === this.config.retryAttempts - 1) {
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    return null;
  }

  // Queue operation for later sync
  private queueOperation(operation: PendingOperation) {
    this.pendingQueue.push(operation);
    this.savePendingQueue();
  }

  private loadPendingQueue() {
    try {
      const stored = localStorage.getItem('lan_pending_queue');
      this.pendingQueue = stored ? JSON.parse(stored) : [];
    } catch {
      this.pendingQueue = [];
    }
  }

  private savePendingQueue() {
    localStorage.setItem('lan_pending_queue', JSON.stringify(this.pendingQueue));
  }

  // Sync pending operations when online
  async syncPendingOperations(): Promise<number> {
    if (!this.isOnline || this.pendingQueue.length === 0) {
      return 0;
    }

    let synced = 0;
    const failed: PendingOperation[] = [];

    for (const op of this.pendingQueue) {
      const result = await this.fetchWithRetry(op.endpoint, {
        method: op.method,
        body: JSON.stringify(op.data),
      });

      if (result) {
        synced++;
      } else {
        failed.push(op);
      }
    }

    this.pendingQueue = failed;
    this.savePendingQueue();
    
    if (synced > 0) {
      this.lastSync = new Date().toISOString();
    }

    return synced;
  }

  // API Methods
  async getVisitors() {
    if (!this.isOnline) return null;
    return this.fetchWithRetry('/visitors');
  }

  async createVisitor(data: unknown) {
    if (!this.isOnline) {
      this.queueOperation({
        endpoint: '/visitors',
        method: 'POST',
        data,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
    return this.fetchWithRetry('/visitors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBiometrics() {
    if (!this.isOnline) return null;
    return this.fetchWithRetry('/biometrics');
  }

  async saveBiometric(visitorId: string, embeddings: number[][], qualityScores: number[]) {
    const data = { visitor_id: visitorId, embeddings, quality_scores: qualityScores };
    
    if (!this.isOnline) {
      this.queueOperation({
        endpoint: '/biometrics',
        method: 'POST',
        data,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
    
    return this.fetchWithRetry('/biometrics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createVisitSession(data: unknown) {
    if (!this.isOnline) {
      this.queueOperation({
        endpoint: '/visits',
        method: 'POST',
        data,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
    return this.fetchWithRetry('/visits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get sync status
  getSyncStatus(): SyncStatus {
    return {
      lastSync: this.lastSync,
      pendingChanges: this.pendingQueue.length,
      isOnline: this.isOnline,
      serverVersion: null,
    };
  }

  // Configure server URL
  setServerUrl(url: string) {
    this.config.baseUrl = url;
    this.checkServerStatus();
  }

  getServerUrl(): string {
    return this.config.baseUrl;
  }
}

interface PendingOperation {
  endpoint: string;
  method: string;
  data: unknown;
  timestamp: string;
}

// Singleton instance
export const lanServer = new LANServerClient();

// Hook for React components
export function useLANServer() {
  return lanServer;
}
