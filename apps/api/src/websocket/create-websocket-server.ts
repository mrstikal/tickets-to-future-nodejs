import { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../lib/logger';
import { createBroadcaster } from './create-broadcaster';
import { verifyToken } from '../services/auth-service';
import type { WebsocketBroadcaster } from '../types/runtime';

interface AuthenticatedWebSocket extends WebSocket {
  isAuthenticated?: boolean;
  userId?: string;
  isAlive?: boolean;
}

export function createWebsocketServer(server: Server): WebsocketBroadcaster {
  const wss = new WebSocketServer({ server, path: '/ws/v1' });
  const broadcaster = createBroadcaster(wss);

  logger.info('WebSocket server initialized on /ws/v1');

  wss.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  wss.on('connection', async (socket: AuthenticatedWebSocket, request) => {
    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    logger.info('WebSocket client connected');

    // Attempt to authenticate the client
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(cookie => {
          const [name, ...rest] = cookie.trim().split('=', 2);
          return [name, rest.join('=')];
        })
      );
      const token = cookies['auth_token'];
      if (token) {
        const result = await verifyToken(token);
        if ('data' in result) {
          socket.isAuthenticated = true;
          socket.userId = result.data.id;
          logger.info(`WebSocket client authenticated: ${socket.userId}`);
        } else {
          logger.warn('WebSocket client provided invalid token');
        }
      }
    }

    socket.send(
      JSON.stringify({
        type: 'connection.ready',
        timestamp: new Date().toISOString(),
        isAuthenticated: socket.isAuthenticated || false,
      })
    );

    socket.on('message', (rawMessage: Buffer) => {
      let message: { type?: string; channels?: string[] };

      try {
        message = JSON.parse(rawMessage.toString()) as {
          type?: string;
          channels?: string[];
        };
      } catch {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid JSON payload.',
          })
        );
        return;
      }

      if (message.type === 'ping') {
        socket.send(
          JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      if (message.type === 'subscribe') {
        socket.send(
          JSON.stringify({
            type: 'subscription.confirmed',
            channels: Array.isArray(message.channels) ? message.channels : [],
          })
        );
        broadcaster.subscribe(socket, message.channels || []);
      }
    });

    socket.on('close', () => {
      logger.info('WebSocket client disconnected');
    });

    socket.on('error', (error: Error) => {
      logger.error('WebSocket client error:', error);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) return authWs.terminate();

      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000); // Ping clients every 30 seconds

  wss.on('close', () => {
    clearInterval(interval);
  });

  return broadcaster;
}
