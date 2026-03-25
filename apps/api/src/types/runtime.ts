import type { Pool } from 'pg';
import type { Channel } from 'amqplib';
import type { Hold } from './domain';

export type PostgresRuntime = {
  name: 'postgres';
  pool: Pool;
  connect: () => Promise<void>;
  checkHealth: () => Promise<string>;
  close: () => Promise<void>;
};

export type RedisRuntime = {
  name: 'redis';
  client: {
    isOpen: boolean;
    connect: () => Promise<unknown>;
    ping: () => Promise<string>;
    quit: () => Promise<string>;
    on: (event: string, listener: (error: unknown) => void) => void;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<string | null>;
    setEx: (key: string, seconds: number, value: string) => Promise<string | null>;
    ttl: (key: string) => Promise<number>;
    del: (key: string | string[]) => Promise<number>;
    keys: (pattern: string) => Promise<string[]>;
    scan: (cursor: number, options: { MATCH: string; COUNT: number }) => Promise<{ cursor: number; keys: string[] }>;
  };
  connect: () => Promise<void>;
  checkHealth: () => Promise<string>;
  close: () => Promise<void>;
};

export type RabbitmqRuntime = {
  name: 'rabbitmq';
  connect: () => Promise<void>;
  checkHealth: () => Promise<string>;
  getChannel: () => Channel | null;
  startConsumers: () => Promise<void>;
  stopConsumers: () => Promise<void>;
  close: () => Promise<void>;
};

export type DependenciesRuntime = {
  postgres: PostgresRuntime | null;
  redis: RedisRuntime | null;
  rabbitmq: RabbitmqRuntime | null;
};


export type WebsocketBroadcaster = {
  broadcast: (payload: unknown) => void;
  broadcastTicketAvailability: (ticket: {
    id: string;
    availableQuantity: number;
    soldQuantity: number;
    activeHolds: number;
  }) => void;
  broadcastHoldExpired: (hold: {
    id: string;
    ticketId: string;
  }) => void;
  broadcastOrderStatusUpdated: (order: {
    id: string;
    status: string;
  }) => void;
  broadcastHoldUpdate: (sessionId: string, hold: Hold) => void;
  subscribe: (socket: import('ws').WebSocket, channels: string[]) => void;
  unsubscribe: (socket: import('ws').WebSocket, channels?: string[]) => void;
};