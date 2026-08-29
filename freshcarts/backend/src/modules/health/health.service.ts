import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  dependencies: {
    database: { status: 'up' | 'down'; state: string; latencyMs?: number };
  };
}

const STATE_LABEL: Record<number, string> = {
  [ConnectionStates.disconnected]: 'disconnected',
  [ConnectionStates.connected]: 'connected',
  [ConnectionStates.connecting]: 'connecting',
  [ConnectionStates.disconnecting]: 'disconnecting',
  [ConnectionStates.uninitialized]: 'uninitialized',
};

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Actively pings MongoDB rather than trusting `readyState`: a socket can look
   * open while the server is unreachable, which is exactly the case a readiness
   * probe exists to catch.
   */
  async check(): Promise<HealthReport> {
    const state = STATE_LABEL[this.connection.readyState] ?? 'unknown';
    const startedAt = Date.now();

    let databaseUp = false;
    let latencyMs: number | undefined;

    try {
      if (this.connection.readyState === ConnectionStates.connected && this.connection.db) {
        await this.connection.db.admin().ping();
        latencyMs = Date.now() - startedAt;
        databaseUp = true;
      }
    } catch {
      databaseUp = false;
    }

    return {
      status: databaseUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: { status: databaseUp ? 'up' : 'down', state, latencyMs },
      },
    };
  }
}
