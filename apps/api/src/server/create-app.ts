import http, { IncomingMessage, ServerResponse } from 'node:http';
import { createRouter } from '../routes/router';
import { createWebsocketServer } from '../websocket/create-websocket-server';
import { setWebsocketRuntime } from '../websocket/websocket-runtime';
import { setDependenciesRuntime } from '../lib/dependencies-runtime';
import { attachRequestLogging } from '../lib/request-logger';
import type { DependenciesRuntime } from '../types/runtime';

function applyCorsHeaders(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
  const allowedOrigins = allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.length > 0) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  } else {
    response.setHeader('Access-Control-Allow-Origin', '*');
  }

  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export function createApp(dependenciesRuntime: DependenciesRuntime) {
  // Set the dependencies runtime once at app creation
  setDependenciesRuntime(dependenciesRuntime);
  
  const router = createRouter();
  const server = http.createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      attachRequestLogging(request, response);

      applyCorsHeaders(request, response);

      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }

      await router(request, response);
    }
  );

  const websocketRuntime = createWebsocketServer(server);
  setWebsocketRuntime(websocketRuntime);

  return server;
}
