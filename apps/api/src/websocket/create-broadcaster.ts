import { WebSocketServer, WebSocket } from 'ws';
import type { WebsocketBroadcaster } from '../types/runtime';
import type { Hold } from '../types/domain';

interface AuthenticatedSocket extends WebSocket {
  isAuthenticated?: boolean;
  userId?: string;
  channels?: string[];
}

export function createBroadcaster(wss: WebSocketServer): WebsocketBroadcaster {
  function broadcastTicketAvailability(ticket: {
    id: string;
    availableQuantity: number;
    soldQuantity: number;
    activeHolds: number;
  }): void {
    const message = JSON.stringify({
      type: 'ticket.availability.updated',
      ticketId: ticket.id,
      availableQuantity: ticket.availableQuantity,
      soldQuantity: ticket.soldQuantity,
      activeHolds: ticket.activeHolds,
      timestamp: new Date().toISOString(),
    });

    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (
        authClient.readyState === WebSocket.OPEN &&
        (authClient.channels?.includes('tickets') ||
          authClient.channels?.includes(`ticket:${ticket.id}`))
      ) {
        authClient.send(message);
      }
    });
  }

  function broadcastHoldExpired(hold: { id: string; ticketId: string }): void {
    const message = JSON.stringify({
      type: 'ticket.hold.expired',
      ticketId: hold.ticketId,
      holdId: hold.id,
      timestamp: new Date().toISOString(),
    });

    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (
        authClient.readyState === WebSocket.OPEN &&
        (authClient.channels?.includes('tickets') ||
          authClient.channels?.includes(`ticket:${hold.ticketId}`))
      ) {
        authClient.send(message);
      }
    });
  }

  function broadcastOrderStatusUpdated(order: {
    id: string;
    status: string;
  }): void {
    // Send order status updates only to authenticated clients
    const message = JSON.stringify({
      type: 'order.status.updated',
      orderId: order.id,
      status: order.status,
      timestamp: new Date().toISOString(),
    });

    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (authClient.readyState === WebSocket.OPEN && authClient.isAuthenticated) {
        authClient.send(message);
      }
    });
  }

  function broadcastHoldUpdate(sessionId: string, hold: Hold): void {
    // Send hold updates only to:
    // 1. Authenticated clients (any authenticated user)
    // 2. OR clients subscribed to the specific session channel
    const message = JSON.stringify({
      type: 'hold.updated',
      sessionId,
      hold: {
        id: hold.id,
        ticketId: hold.ticketId,
        status: hold.status,
        expiresAt: hold.expiresAt,
      },
      timestamp: new Date().toISOString(),
    });

    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (authClient.readyState !== WebSocket.OPEN) return;

      // Check if client is authenticated
      if (authClient.isAuthenticated) {
        authClient.send(message);
        return;
      }

      // Check if client is subscribed to this session channel
      const subscribedChannels = authClient.channels || [];
      if (subscribedChannels.includes(`session.${sessionId}`)) {
        authClient.send(message);
      }
    });
  }

  function broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function subscribe(socket: WebSocket, channels: string[]): void {
    // Store subscription channels on the socket for future use
    (socket as AuthenticatedSocket).channels = channels;
  }

  function unsubscribe(socket: WebSocket, channels?: string[]): void {
    const socketWithChannels = socket as AuthenticatedSocket;
    if (channels && channels.length > 0) {
      // Remove specific channels
      const socketChannels = socketWithChannels.channels || [];
      socketWithChannels.channels = socketChannels.filter(
        (ch: string) => !channels.includes(ch)
      );
    } else {
      // Remove all channels
      socketWithChannels.channels = [];
    }
  }

  return {
    broadcast,
    broadcastTicketAvailability,
    broadcastHoldExpired,
    broadcastOrderStatusUpdated,
    broadcastHoldUpdate,
    subscribe,
    unsubscribe,
  };
}

