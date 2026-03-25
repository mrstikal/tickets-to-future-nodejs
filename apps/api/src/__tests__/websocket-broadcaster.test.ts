/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBroadcaster } from '../websocket/create-broadcaster';
import { WebSocketServer, WebSocket } from 'ws';

describe('websocket broadcaster', () => {
  let wss: WebSocketServer;

  beforeEach(() => {
    // Minimal fake WebSocketServer with clients set
    wss = {
      clients: new Set(),
    } as unknown as WebSocketServer;
  });

  it('broadcastTicketAvailability sends to subscribed clients only', () => {
    const broadcaster = createBroadcaster(wss as WebSocketServer);

    const clientA = { readyState: WebSocket.OPEN, send: vi.fn(), channels: ['tickets'] } as unknown as WebSocket & { channels?: string[] };
    const clientB = { readyState: WebSocket.OPEN, send: vi.fn(), channels: ['other'] } as unknown as WebSocket & { channels?: string[] };
    (wss.clients as Set<any>).add(clientA);
    (wss.clients as Set<any>).add(clientB);

    broadcaster.broadcastTicketAvailability({ id: 't1', availableQuantity: 5, soldQuantity: 2, activeHolds: 1 });

    expect((clientA as any).send).toHaveBeenCalled();
    expect((clientB as any).send).not.toHaveBeenCalled();
  });

  it('broadcastOrderStatusUpdated sends only to authenticated clients', () => {
    const broadcaster = createBroadcaster(wss as WebSocketServer);

    const clientA = { readyState: WebSocket.OPEN, send: vi.fn(), isAuthenticated: true } as unknown as WebSocket & { isAuthenticated?: boolean };
    const clientB = { readyState: WebSocket.OPEN, send: vi.fn(), isAuthenticated: false } as unknown as WebSocket & { isAuthenticated?: boolean };
    (wss.clients as Set<any>).add(clientA);
    (wss.clients as Set<any>).add(clientB);

    broadcaster.broadcastOrderStatusUpdated({ id: 'o1', status: 'confirmed' });

    expect((clientA as any).send).toHaveBeenCalled();
    expect((clientB as any).send).not.toHaveBeenCalled();
  });

  it('broadcastHoldUpdate sends to authenticated or subscribed session channel', () => {
    const broadcaster = createBroadcaster(wss as WebSocketServer);
    const clientAuth = { readyState: WebSocket.OPEN, send: vi.fn(), isAuthenticated: true } as unknown as WebSocket & { isAuthenticated?: boolean };
    const clientSub = { readyState: WebSocket.OPEN, send: vi.fn(), channels: ['session.s1'] } as unknown as WebSocket & { channels?: string[] };
    const clientOther = { readyState: WebSocket.OPEN, send: vi.fn(), channels: ['session.s2'] } as unknown as WebSocket & { channels?: string[] };
    (wss.clients as Set<any>).add(clientAuth);
    (wss.clients as Set<any>).add(clientSub);
    (wss.clients as Set<any>).add(clientOther);

    broadcaster.broadcastHoldUpdate('s1', { id: 'h1', ticketId: 't1', sessionId: 's1', status: 'confirmed', expiresAt: new Date().toISOString(), ttlSeconds: 100, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);

    expect((clientAuth as any).send).toHaveBeenCalled();
    expect((clientSub as any).send).toHaveBeenCalled();
    expect((clientOther as any).send).not.toHaveBeenCalled();
  });
});
